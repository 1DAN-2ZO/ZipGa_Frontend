import { PENALTY_THRESHOLD, ROUNDS_PER_SESSION, validateGameResult } from '../types'
import type { GameResult } from '../types'

const valid: GameResult = {
  normalizedScore: 87.5,
  score: 18,
  tiebreakMs: 24310,
  finished: true,
}

describe('상수', () => {
  it('벌칙 기준선은 40이다', () => {
    expect(PENALTY_THRESHOLD).toBe(40)
  })

  it('한 세션은 3판이다', () => {
    expect(ROUNDS_PER_SESSION).toBe(3)
  })
})

describe('validateGameResult', () => {
  it('정상 결과에는 문제가 없다', () => {
    expect(validateGameResult(valid, 'sentenceCopy')).toEqual([])
  })

  it('경계값 0과 100을 허용한다', () => {
    expect(validateGameResult({ ...valid, normalizedScore: 0 }, 'g')).toEqual([])
    expect(validateGameResult({ ...valid, normalizedScore: 100 }, 'g')).toEqual([])
  })

  it('normalizedScore가 100을 넘으면 잡아낸다', () => {
    const problems = validateGameResult({ ...valid, normalizedScore: 150 }, 'g')
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('normalizedScore')
  })

  it('normalizedScore가 음수면 잡아낸다', () => {
    expect(validateGameResult({ ...valid, normalizedScore: -1 }, 'g')).toHaveLength(1)
  })

  it('normalizedScore가 NaN이면 잡아낸다', () => {
    expect(validateGameResult({ ...valid, normalizedScore: NaN }, 'g')).toHaveLength(1)
  })

  it('tiebreakMs가 음수면 잡아낸다', () => {
    const problems = validateGameResult({ ...valid, tiebreakMs: -5 }, 'g')
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('tiebreakMs')
  })

  it('score가 유한수가 아니면 잡아낸다', () => {
    expect(validateGameResult({ ...valid, score: Infinity }, 'g')).toHaveLength(1)
  })

  it('문제가 여러 개면 전부 보고한다', () => {
    const problems = validateGameResult(
      { normalizedScore: 200, score: NaN, tiebreakMs: -1, finished: true },
      'g',
    )
    expect(problems).toHaveLength(3)
  })

  it('게임 id를 메시지에 포함한다', () => {
    const problems = validateGameResult({ ...valid, normalizedScore: 150 }, 'cardmatch')
    expect(problems[0]).toContain('cardmatch')
  })
})
