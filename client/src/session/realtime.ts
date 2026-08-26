import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { SessionRow } from './useSession'

/**
 * 세션 관련 실시간 구독.
 *
 * Broadcast가 아니라 Postgres Changes를 쓴다 — DB가 진실의 원천이라 메시지를
 * 놓쳐도 다시 읽으면 복구된다. 술집 LTE에서 순단이 잦다
 * (백엔드_Supabase명세.md §7).
 *
 * RLS가 Realtime에도 적용되므로 구독자는 자기 방의 변경만 받는다.
 */

/**
 * 세션 시작 신호(sessions INSERT).
 *
 * 방장은 start_session의 응답으로 세션을 알지만, 참가자는 이 구독으로만 알게 된다.
 * starts_at이 미래 시각이라 알림이 몇백 ms 늦어도 출발선은 어긋나지 않는다.
 */
export function subscribeSessionStart(
  roomId: string,
  onStart: (row: SessionRow) => void,
): () => void {
  let channel: RealtimeChannel | null = supabase
    .channel(`session-start:${roomId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'sessions', filter: `room_id=eq.${roomId}` },
      (payload) => {
        const row = payload.new as { id: string; seed: number; starts_at: string }
        onStart({ session_id: row.id, seed: row.seed, starts_at: row.starts_at })
      },
    )
    .subscribe()

  return () => {
    channel?.unsubscribe()
    channel = null
  }
}

/** 한 판에 대한 남의 점수 한 줄. */
export interface RoundScore {
  playerId: string
  nickname: string
  /** 판정에 쓰이는 값 */
  normalized: number
  /** 화면 표시 전용 원점수 */
  rawScore: number
  tiebreakMs: number
  finished: boolean
}

interface ScoreRow {
  player_id: string
  normalized: number
  raw_score: number
  tiebreak_ms: number
  finished: boolean
  players: { nickname: string } | { nickname: string }[] | null
}

/** 조인 결과가 객체로 올 때와 배열로 올 때가 있어 한 겹 벗겨준다. */
function nicknameOf(row: ScoreRow): string {
  const joined = Array.isArray(row.players) ? row.players[0] : row.players
  return joined?.nickname ?? '???'
}

/**
 * 그 판의 순위.
 *
 * normalized 내림차순, 동점이면 tiebreakMs 오름차순으로 정렬해서 돌려준다
 * (프론트엔드_화면명세.md S7).
 */
export async function listRoundScores(
  sessionId: string,
  roundIndex: number,
): Promise<RoundScore[]> {
  const { data, error } = await supabase
    .from('scores')
    .select('player_id, normalized, raw_score, tiebreak_ms, finished, players(nickname)')
    .eq('session_id', sessionId)
    .eq('round_index', roundIndex)

  if (error) throw error

  return (data as unknown as ScoreRow[])
    .map((row) => ({
      playerId: row.player_id,
      nickname: nicknameOf(row),
      normalized: Number(row.normalized),
      rawScore: row.raw_score,
      tiebreakMs: row.tiebreak_ms,
      finished: row.finished,
    }))
    .sort((a, b) => b.normalized - a.normalized || a.tiebreakMs - b.tiebreakMs)
}

/**
 * 그 판에 점수가 하나 올라올 때마다 목록을 다시 읽어 넘긴다.
 *
 * 다 같이 끝나는 게 아니라 먼저 끝낸 사람부터 올라오므로,
 * 판 결과 화면은 인원이 차는 걸 실시간으로 보여줄 수 있다.
 */
export function subscribeRoundScores(
  sessionId: string,
  roundIndex: number,
  onChange: (scores: RoundScore[]) => void,
): () => void {
  const push = () => {
    listRoundScores(sessionId, roundIndex).then(onChange).catch(() => {})
  }
  push()

  let channel: RealtimeChannel | null = supabase
    .channel(`round-scores:${sessionId}:${roundIndex}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'scores', filter: `session_id=eq.${sessionId}` },
      push,
    )
    .subscribe()

  return () => {
    channel?.unsubscribe()
    channel = null
  }
}
