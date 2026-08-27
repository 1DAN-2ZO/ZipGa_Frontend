import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { ROUNDS_PER_SESSION } from '../games/types'

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

/** sessionId에서 아직 3판을 다 못 낸 참가자 수. 세션 종료(판정) 시점을 늦출지
 * 결정하는 데만 쓴다 — 벌칙 판정 자체는 여전히 "3판 평균 < 40" 하나뿐이다. */
async function countPendingSubmitters(sessionId: string, participantIds: readonly string[]): Promise<number> {
  if (participantIds.length === 0) return 0

  const { data, error } = await supabase.from('scores').select('player_id').eq('session_id', sessionId)
  if (error) throw error

  const submittedCount = new Map<string, number>()
  for (const row of data as Array<{ player_id: string }>) {
    submittedCount.set(row.player_id, (submittedCount.get(row.player_id) ?? 0) + 1)
  }

  return participantIds.filter((id) => (submittedCount.get(id) ?? 0) < ROUNDS_PER_SESSION).length
}

/**
 * 종합 판정(end_session) 전에 뒤처진 참가자를 최대 이만큼 기다려준다.
 *
 * 이 대기는 세션 시작이 아니라 "이 기기가 자기 3판을 끝낸 시점"부터 잰다
 * (waitForAllScores 호출부인 useSession.ts 참고) — 그러니까 실질적으로
 * 가장 먼저 끝낸 사람 기준 최대 대기다.
 */
export const END_SESSION_WAIT_MS = 30_000

/**
 * 이 세션에 참여한 사람 전원이 3판을 다 낼 때까지(또는 timeoutMs가 지날 때까지)
 * 기다린다. 정확히 언제 종합 판정(end_session)을 부를지를 늦추는 용도다.
 *
 * "느리게 진행된 플레이어를 강제로 강퇴하는 별도 규칙"이 아니다 — end_session이
 * 부르는 시점만 조절할 뿐, 벌칙 판정은 여전히 "3판 평균 < 40" 하나로만 갈린다.
 * 아무도 안 늦었으면(이미 전원 제출 완료) 즉시 반환해 지연이 없다.
 */
export function waitForAllScores(
  sessionId: string,
  participantIds: readonly string[],
  timeoutMs: number = END_SESSION_WAIT_MS,
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    let channel: RealtimeChannel | null = null

    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      channel?.unsubscribe()
      channel = null
      resolve()
    }

    const timer = setTimeout(finish, timeoutMs)

    const check = () => {
      countPendingSubmitters(sessionId, participantIds)
        .then((pending) => {
          if (pending === 0) finish()
        })
        .catch(() => {
          // 조회 실패는 무시한다 — timeoutMs가 최종 방어선이다.
        })
    }

    channel = supabase
      .channel(`session-wait:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'scores', filter: `session_id=eq.${sessionId}` },
        check,
      )
      .subscribe()

    check() // 이미 전원 제출 완료된 상태일 수 있으니 최초 한 번 바로 확인한다
  })
}
