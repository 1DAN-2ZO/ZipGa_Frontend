import type { GameResult } from '../games/types'
import { ROUNDS_PER_SESSION } from '../games/types'
import type { RoundPlan } from './lineup'

export type SessionPhase =
  | 'lineup' // 게임 3개 공개 중
  | 'countdown' // 3·2·1
  | 'playing' // 게임 진행 중
  | 'roundResult' // 그 판 순위 표시
  | 'final' // 세션 종합 결과

export interface SessionState {
  plan: RoundPlan[]
  phase: SessionPhase
  roundIndex: number
  /** 내가 낸 판별 결과. 인덱스가 곧 판 번호다. */
  results: GameResult[]
}

export type SessionEvent =
  | { type: 'LINEUP_SHOWN' }
  | { type: 'COUNTDOWN_DONE' }
  | { type: 'ROUND_FINISHED'; result: GameResult }
  | { type: 'ROUND_RESULT_DONE' }

export function initSession(plan: RoundPlan[]): SessionState {
  return { plan, phase: 'lineup', roundIndex: 0, results: [] }
}

export function sessionReducer(state: SessionState, event: SessionEvent): SessionState {
  switch (state.phase) {
    case 'lineup':
      return event.type === 'LINEUP_SHOWN' ? { ...state, phase: 'countdown' } : state

    case 'countdown':
      return event.type === 'COUNTDOWN_DONE' ? { ...state, phase: 'playing' } : state

    case 'playing':
      return event.type === 'ROUND_FINISHED'
        ? { ...state, phase: 'roundResult', results: [...state.results, event.result] }
        : state

    case 'roundResult': {
      if (event.type !== 'ROUND_RESULT_DONE') return state
      const next = state.roundIndex + 1
      return next >= ROUNDS_PER_SESSION
        ? { ...state, phase: 'final' }
        : { ...state, phase: 'countdown', roundIndex: next }
    }

    case 'final':
      return state
  }
}

export function currentRound(state: SessionState): RoundPlan {
  return state.plan[state.roundIndex]
}

/**
 * 3판 평균. final 이전에는 항상 null이다.
 *
 * 판 사이에 누적 평균이 보이면 3판째까지 유지돼야 할 긴장이 사라진다.
 * 관례가 아니라 타입으로 막는다.
 *
 * 나누는 수는 실제 제출 수가 아니라 ROUNDS_PER_SESSION이다.
 * 미제출 판이 0점으로 흡수되어야 하기 때문이다.
 */
export function sessionAverage(state: SessionState): number | null {
  if (state.phase !== 'final') return null
  const total = state.results.reduce((sum, r) => sum + r.normalizedScore, 0)
  return total / ROUNDS_PER_SESSION
}
