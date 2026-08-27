import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { SessionRow } from '../session/useSession'

/**
 * 방장이 아닌 참가자는 start_session 응답을 못 받으므로, sessions INSERT를
 * Realtime으로 구독해 세션 시작을 알아챈다. (mdfile/백엔드_Supabase명세.md §7)
 */
export function subscribeSessionStart(roomId: string, onStart: (row: SessionRow) => void): () => void {
  let channel: RealtimeChannel | null = supabase
    .channel(`room-sessions:${roomId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'sessions', filter: `room_id=eq.${roomId}` },
      ({ new: row }) => {
        onStart({
          session_id: row.id as string,
          seed: row.seed as number,
          starts_at: row.starts_at as string,
        })
      },
    )
    .subscribe()

  return () => {
    channel?.unsubscribe()
    channel = null
  }
}

/**
 * 이 시각보다 오래된 세션은 죽은 것으로 본다(ms).
 *
 * 한 세션의 최대 길이는 상수들로 정해져 있다 —
 *   게임 3개 공개 3.9초 + 서버가 주는 출발 여유 5초
 *   + 3라운드 x (제한시간 20초 + 호스트 강제 종료 여유 5초 + 판 결과 3초)
 *   = 약 93초.
 * 10분이면 그 5배가 넘으므로, 여기 걸리는 세션은 정상 진행 중일 수가 없다.
 *
 * 이런 세션이 생기는 이유: ended_at을 채우는 곳이 end_session RPC 하나뿐인데,
 * 그건 3판을 끝까지 돈 클라이언트만 부른다. 도중에 전원이 탭을 닫거나
 * 새로고침하면 아무도 안 부르고, 그 방은 계속 "게임 진행 중"으로 남는다.
 */
const STALE_SESSION_MS = 10 * 60 * 1000

interface ActiveSessionRow {
  id: string
  starts_at: string
}

/** 지금 이 방에서 돌고 있는 세션. */
export interface ActiveSession {
  id: string
  /** 서버가 정한 시작 시각(ISO). 방금 시작한 건지 판단하는 데 쓴다 */
  startsAt: string
}

/** 시작한 지 너무 오래됐으면 버려진 세션이다. */
function isStale(row: ActiveSessionRow): boolean {
  const startedAt = Date.parse(row.starts_at)
  if (!Number.isFinite(startedAt)) return false
  return Date.now() - startedAt > STALE_SESSION_MS
}

/**
 * 지금 이 방에 진행 중인(ended_at이 비어있는) 세션이 있는지 확인한다.
 *
 * 세션 도중 새로 입장·재입장한 사람은 여기에 끼면 안 된다(mdfile/프론트엔드_화면명세.md
 * S11) — 게임 3개와 시드가 이미 배포된 뒤라 중간에 낄 방법이 없기 때문이다.
 *
 * 단, 버려진 세션은 없는 것으로 친다. 안 그러면 그 방에 들어오는 사람이
 * 전부 대기 화면에 갇힌다 — 방이 만료될 때까지(2시간) 아무도 못 논다.
 */
export async function getActiveSession(roomId: string): Promise<ActiveSession | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, starts_at')
    .eq('room_id', roomId)
    .is('ended_at', null)
    .order('starts_at', { ascending: false })
    .limit(1)

  if (error) throw error
  const row = (data as ActiveSessionRow[])[0]
  if (!row || isStale(row)) return null
  return { id: row.id, startsAt: row.starts_at }
}

/**
 * 이 방의 "지금 진행 중인 세션이 있는가"를 계속 최신으로 유지한다.
 * 새 세션이 시작되면 그 세션을, 세션이 끝나면 null을 콜백으로 넘긴다.
 *
 * startsAt을 같이 넘기는 이유: 이 구독과 subscribeSessionStart는 같은 INSERT를
 * 서로 다른 채널로 듣는다. 채널이 다르면 도착 순서가 보장되지 않아서, 이쪽이
 * 먼저 오면 "세션은 있는데 나는 아직 합류를 못 했다"는 상태가 잠깐 생긴다.
 * 그 순간을 늦게 들어온 사람으로 오해하면 정작 같이 시작한 사람이 대기 화면으로
 * 튕긴다. 호출부가 "방금 시작한 건지"를 판단할 수 있어야 한다.
 */
export function subscribeActiveSession(roomId: string, onChange: (session: ActiveSession | null) => void): () => void {
  let channel: RealtimeChannel | null = supabase
    .channel(`room-active-session:${roomId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'sessions', filter: `room_id=eq.${roomId}` },
      ({ new: row }) => {
        const r = row as unknown as ActiveSessionRow
        onChange(isStale(r) ? null : { id: r.id, startsAt: r.starts_at })
      },
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `room_id=eq.${roomId}` },
      ({ new: row }) => {
        if (row.ended_at) onChange(null)
      },
    )
    .subscribe()

  return () => {
    channel?.unsubscribe()
    channel = null
  }
}

/**
 * 다음 세션이 "슬슬 할 때가 됐다"고 알릴 시각(ms epoch). 시작을 강제하지 않는다 —
 * 방장이 여전히 아무 때나 누를 수 있고, 이건 로비 배지·카운트다운 표시용 정보일 뿐이다
 * (mdfile/프론트엔드_화면명세.md S3 "시작 버튼 ... 주기 도달 전에도 누를 수 있음").
 *
 * 기준 시각은 이 방의 마지막으로 끝난 세션의 ended_at, 아직 세션이 한 번도 안 끝났다면
 * 방 생성 시각(created_at)이다. 여기에 방장이 고른 session_period_min(분)을 더한다.
 */
export async function getNextSessionDueAt(roomId: string): Promise<number> {
  const [{ data: room, error: roomError }, { data: lastEnded, error: sessionError }] = await Promise.all([
    supabase.from('rooms').select('session_period_min, created_at').eq('id', roomId).single(),
    supabase
      .from('sessions')
      .select('ended_at')
      .eq('room_id', roomId)
      .not('ended_at', 'is', null)
      .order('ended_at', { ascending: false })
      .limit(1),
  ])

  if (roomError) throw roomError
  if (sessionError) throw sessionError

  const periodMin = (room as { session_period_min: number }).session_period_min
  const baselineIso =
    (lastEnded as Array<{ ended_at: string }>)[0]?.ended_at ?? (room as { created_at: string }).created_at
  return Date.parse(baselineIso) + periodMin * 60_000
}

/**
 * 세션 시작 신호를 기다려주는 유예(ms).
 *
 * 서버는 starts_at을 now()+5초로 잡는다(백엔드 c_lead_sec). 거기에 이만큼을 더
 * 얹어 INSERT 시점 기준 약 10초를 기다린다 — 술집 LTE에서 Realtime이 한 박자
 * 늦게 와도 같이 시작한 사람이 튕기지 않을 만큼이다.
 */
export const JOIN_SIGNAL_GRACE_MS = 5000

/**
 * 아직 합류하지 못한 사람을 대기 화면으로 보내기까지 얼마나 기다릴지(ms).
 * 0이면 즉시 = 세션 도중에 들어온 사람이다.
 *
 * 바로 판단하면 안 되는 이유: subscribeActiveSession과 subscribeSessionStart는
 * 같은 INSERT를 서로 다른 채널로 듣기 때문에 도착 순서가 보장되지 않는다.
 * 앞의 것이 먼저 오면 "세션은 있는데 나는 아직 합류를 못 했다"는 상태가 잠깐
 * 생기는데, 그걸 늦게 들어온 사람으로 오해하면 같이 시작한 사람이 대기 화면에
 * 갇힌다 — 세션이 끝나야 빠져나오므로 그 판을 통째로 날린다.
 */
export function waitBeforeBounce(startsAtIso: string, nowMs: number): number {
  const startedAt = Date.parse(startsAtIso)
  if (!Number.isFinite(startedAt)) return 0
  return Math.max(0, startedAt + JOIN_SIGNAL_GRACE_MS - nowMs)
}
