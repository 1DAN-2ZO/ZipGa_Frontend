import type { GameResult } from '../../games/types'
import type { RoundPlan } from '../lineup'
import { currentRound, initSession, sessionAverage, sessionReducer } from '../machine'

const PLAN: RoundPlan[] = [
  { roundIndex: 0, gameId: 'a', seed: 11, timeLimitSec: 10 },
  { roundIndex: 1, gameId: 'b', seed: 22, timeLimitSec: 20 },
  { roundIndex: 2, gameId: 'c', seed: 33, timeLimitSec: 30 },
]

function result(normalizedScore: number): GameResult {
  return { normalizedScore, score: 0, tiebreakMs: 100, finished: true }
}

/** lineup에서 시작해 지정한 점수들로 판을 끝까지 진행시킨다. */
function playThrough(scores: number[]) {
  let s = initSession(PLAN)
  s = sessionReducer(s, { type: 'LINEUP_SHOWN' })
  for (const score of scores) {
    s = sessionReducer(s, { type: 'COUNTDOWN_DONE' })
    s = sessionReducer(s, { type: 'ROUND_FINISHED', result: result(score) })
    s = sessionReducer(s, { type: 'ROUND_RESULT_DONE' })
  }
  return s
}

describe('initSession', () => {
  it('lineup 단계 0판에서 시작한다', () => {
    const s = initSession(PLAN)
    expect(s.phase).toBe('lineup')
    expect(s.roundIndex).toBe(0)
    expect(s.results).toEqual([])
  })
})

describe('진행 순서', () => {
  it('lineup → countdown → playing → roundResult 순으로 간다', () => {
    let s = initSession(PLAN)
    s = sessionReducer(s, { type: 'LINEUP_SHOWN' })
    expect(s.phase).toBe('countdown')

    s = sessionReducer(s, { type: 'COUNTDOWN_DONE' })
    expect(s.phase).toBe('playing')

    s = sessionReducer(s, { type: 'ROUND_FINISHED', result: result(80) })
    expect(s.phase).toBe('roundResult')
    expect(s.results).toHaveLength(1)
  })

  it('판이 끝나면 다음 판 카운트다운으로 넘어간다', () => {
    const s = playThrough([80])
    expect(s.phase).toBe('countdown')
    expect(s.roundIndex).toBe(1)
  })

  it('3판이 끝나면 final로 간다', () => {
    const s = playThrough([80, 70, 60])
    expect(s.phase).toBe('final')
    expect(s.roundIndex).toBe(2)
    expect(s.results).toHaveLength(3)
  })

  it('단계에 맞지 않는 이벤트는 무시한다', () => {
    const s = initSession(PLAN)
    expect(sessionReducer(s, { type: 'COUNTDOWN_DONE' })).toEqual(s)
    expect(sessionReducer(s, { type: 'ROUND_RESULT_DONE' })).toEqual(s)
  })

  it('final에서는 더 이상 움직이지 않는다', () => {
    const s = playThrough([80, 70, 60])
    expect(sessionReducer(s, { type: 'ROUND_RESULT_DONE' })).toEqual(s)
    expect(sessionReducer(s, { type: 'LINEUP_SHOWN' })).toEqual(s)
  })
})

describe('currentRound', () => {
  it('지금 판의 편성을 준다', () => {
    let s = initSession(PLAN)
    expect(currentRound(s).gameId).toBe('a')
    s = playThrough([80])
    expect(currentRound(s).gameId).toBe('b')
  })
})

describe('sessionAverage', () => {
  it('final 이전에는 절대 값을 주지 않는다', () => {
    let s = initSession(PLAN)
    expect(sessionAverage(s)).toBeNull()

    s = sessionReducer(s, { type: 'LINEUP_SHOWN' })
    s = sessionReducer(s, { type: 'COUNTDOWN_DONE' })
    s = sessionReducer(s, { type: 'ROUND_FINISHED', result: result(100) })
    expect(s.phase).toBe('roundResult')
    expect(sessionAverage(s)).toBeNull()
  })

  it('final에서 3판 평균을 준다', () => {
    expect(sessionAverage(playThrough([90, 60, 30]))).toBe(60)
  })

  it('미제출 판은 0점으로 흡수한다 (합계/3이지 avg가 아니다)', () => {
    // 두 판만 만점이고 한 판이 없으면 100이 아니라 66.67이어야 한다
    let s = initSession(PLAN)
    s = sessionReducer(s, { type: 'LINEUP_SHOWN' })
    for (const score of [100, 100]) {
      s = sessionReducer(s, { type: 'COUNTDOWN_DONE' })
      s = sessionReducer(s, { type: 'ROUND_FINISHED', result: result(score) })
      s = sessionReducer(s, { type: 'ROUND_RESULT_DONE' })
    }
    // 아직 final이 아니므로 강제로 final 상태를 만들어 확인한다
    const forced = { ...s, phase: 'final' as const }
    expect(sessionAverage(forced)).toBeCloseTo(200 / 3)
  })

  it('전부 0점이면 0이다', () => {
    expect(sessionAverage(playThrough([0, 0, 0]))).toBe(0)
  })
})
