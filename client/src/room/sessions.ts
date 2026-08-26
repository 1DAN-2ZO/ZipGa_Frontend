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
 * 지금 이 방에 진행 중인(ended_at이 비어있는) 세션이 있는지 확인한다.
 *
 * 세션 도중 새로 입장·재입장한 사람은 여기에 끼면 안 된다(mdfile/프론트엔드_화면명세.md
 * S11) — 게임 3개와 시드가 이미 배포된 뒤라 중간에 낄 방법이 없기 때문이다.
 */
export async function getActiveSessionId(roomId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id')
    .eq('room_id', roomId)
    .is('ended_at', null)
    .limit(1)

  if (error) throw error
  const rows = data as Array<{ id: string }>
  return rows[0]?.id ?? null
}

/**
 * 이 방의 "지금 진행 중인 세션이 있는가"를 계속 최신으로 유지한다.
 * 새 세션이 시작되면 그 id를, 세션이 끝나면 null을 콜백으로 넘긴다.
 */
export function subscribeActiveSession(roomId: string, onChange: (sessionId: string | null) => void): () => void {
  let channel: RealtimeChannel | null = supabase
    .channel(`room-active-session:${roomId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'sessions', filter: `room_id=eq.${roomId}` },
      ({ new: row }) => onChange(row.id as string),
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
