import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface RoundScoreRow {
  playerId: string
  normalized: number
  tiebreakMs: number
}

/**
 * 이 판(session_id, round_index)에 제출된 전원의 점수.
 *
 * 닉네임은 안 담는다 — 방 참가자 목록(players.ts)에서 이미 들고 있으므로
 * 화면에서 playerId로 조인한다.
 */
export async function listRoundScores(sessionId: string, roundIndex: number): Promise<RoundScoreRow[]> {
  const { data, error } = await supabase
    .from('scores')
    .select('player_id, normalized, tiebreak_ms')
    .eq('session_id', sessionId)
    .eq('round_index', roundIndex)

  if (error) throw error
  return (data as Array<{ player_id: string; normalized: number; tiebreak_ms: number }>).map((r) => ({
    playerId: r.player_id,
    normalized: r.normalized,
    tiebreakMs: r.tiebreak_ms,
  }))
}

/**
 * 세션 전체(3판) 점수. end_session RPC 응답을 못 받은 사람이 전체 순위를
 * 직접 재구성할 때 쓴다 — end_session은 "먼저 도착한 한 번만" 실행되므로
 * 뒤에 도착한 사람은 응답 대신 이 raw 데이터로 같은 계산을 다시 한다.
 */
export async function listSessionScores(sessionId: string): Promise<RoundScoreRow[]> {
  const { data, error } = await supabase
    .from('scores')
    .select('player_id, normalized, tiebreak_ms')
    .eq('session_id', sessionId)

  if (error) throw error
  return (data as Array<{ player_id: string; normalized: number; tiebreak_ms: number }>).map((r) => ({
    playerId: r.player_id,
    normalized: r.normalized,
    tiebreakMs: r.tiebreak_ms,
  }))
}

/**
 * 다른 사람 제출 현황을 실시간으로 받는다. 사람마다 끝내는 타이밍이 달라
 * 판 결과 화면을 보는 동안에도 점수가 하나씩 들어온다.
 */
export function subscribeToRoundScores(
  sessionId: string,
  roundIndex: number,
  onChange: (scores: RoundScoreRow[]) => void,
): () => void {
  let channel: RealtimeChannel | null = supabase
    .channel(`session-scores:${sessionId}:${roundIndex}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'scores', filter: `session_id=eq.${sessionId}` },
      () => {
        listRoundScores(sessionId, roundIndex).then(onChange).catch(() => {})
      },
    )
    .subscribe()

  return () => {
    channel?.unsubscribe()
    channel = null
  }
}
