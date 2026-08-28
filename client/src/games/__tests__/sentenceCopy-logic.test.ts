import {
  buildSequence,
  computeResult,
  isExactMatch,
  PASS_COUNT,
  PERFECT_COUNT,
} from '../sentenceCopy/logic'
import { PENALTY_THRESHOLD } from '../types'
import { validateGameResult } from '../types'

describe('buildSequence', () => {
  const pool = ['가나다', '라마바', '사아자', '차카타', '파하']

  test('같은 seed는 같은 문장 순서를 만든다', () => {
    expect(buildSequence(12345, pool)).toEqual(buildSequence(12345, pool))
  })

  test('다른 seed는 다른 문장 순서를 만든다', () => {
    expect(buildSequence(1, pool)).not.toEqual(buildSequence(2, pool))
  })

  test('풀의 모든 문장을 빠짐없이 담는다', () => {
    expect([...buildSequence(777, pool)].sort()).toEqual([...pool].sort())
  })

  test('원본 풀 배열을 변형하지 않는다', () => {
    const original = [...pool]
    buildSequence(42, pool)
    expect(pool).toEqual(original)
  })
})

describe('isExactMatch', () => {
  test('완전히 똑같이 쓰면 정답이다', () => {
    expect(isExactMatch('오늘은 여기까지', '오늘은 여기까지')).toBe(true)
  })

  test('앞뒤 공백은 무시한다', () => {
    expect(isExactMatch('  오늘은 여기까지  ', '오늘은 여기까지')).toBe(true)
  })

  test('글자가 하나라도 다르면 오답이다', () => {
    expect(isExactMatch('오늘은 여기까쥐', '오늘은 여기까지')).toBe(false)
  })

  test('중간 공백이 다르면 오답이다', () => {
    expect(isExactMatch('오늘은  여기까지', '오늘은 여기까지')).toBe(false)
  })

  test('문장부호를 빠뜨리면 오답이다', () => {
    expect(isExactMatch('진짜야', '진짜야?')).toBe(false)
  })

  test('아직 다 못 쓴 상태는 오답이다', () => {
    expect(isExactMatch('오늘은', '오늘은 여기까지')).toBe(false)
  })

  test('빈 입력은 오답이다', () => {
    expect(isExactMatch('', '오늘은 여기까지')).toBe(false)
  })
})

describe('computeResult', () => {
  const TIME_LIMIT = 20

  test('score는 맞힌 문장 개수 그대로다', () => {
    const result = computeResult({
      correctCount: 3,
      lastCorrectElapsedMs: 9000,
      timeLimitSec: TIME_LIMIT,
      finished: true,
    })
    expect(result.score).toBe(3)
  })

  test('한 개도 못 맞히면 normalizedScore가 0이다', () => {
    const result = computeResult({
      correctCount: 0,
      lastCorrectElapsedMs: 0,
      timeLimitSec: TIME_LIMIT,
      finished: true,
    })
    expect(result.normalizedScore).toBe(0)
  })

  test('기준 개수를 맞히면 normalizedScore가 100이다', () => {
    const result = computeResult({
      correctCount: PERFECT_COUNT,
      lastCorrectElapsedMs: 18000,
      timeLimitSec: TIME_LIMIT,
      finished: true,
    })
    expect(result.normalizedScore).toBe(100)
  })

  test('기준 개수를 넘겨도 normalizedScore는 100을 넘지 않는다', () => {
    const result = computeResult({
      correctCount: PERFECT_COUNT + 5,
      lastCorrectElapsedMs: 19000,
      timeLimitSec: TIME_LIMIT,
      finished: true,
    })
    expect(result.normalizedScore).toBe(100)
  })

  test('많이 맞힐수록 normalizedScore가 높다', () => {
    const few = computeResult({
      correctCount: 1,
      lastCorrectElapsedMs: 5000,
      timeLimitSec: TIME_LIMIT,
      finished: true,
    })
    const many = computeResult({
      correctCount: 4,
      lastCorrectElapsedMs: 5000,
      timeLimitSec: TIME_LIMIT,
      finished: true,
    })
    expect(many.normalizedScore).toBeGreaterThan(few.normalizedScore)
  })

  test('tiebreakMs는 마지막 정답까지 걸린 시간이다', () => {
    const result = computeResult({
      correctCount: 2,
      lastCorrectElapsedMs: 7400,
      timeLimitSec: TIME_LIMIT,
      finished: true,
    })
    expect(result.tiebreakMs).toBe(7400)
  })

  test('한 개도 못 맞히면 tiebreakMs는 제한시간 전체다', () => {
    const result = computeResult({
      correctCount: 0,
      lastCorrectElapsedMs: 0,
      timeLimitSec: TIME_LIMIT,
      finished: true,
    })
    expect(result.tiebreakMs).toBe(TIME_LIMIT * 1000)
  })

  test('중도 이탈해도 그때까지 맞힌 개수는 점수로 인정한다', () => {
    const result = computeResult({
      correctCount: 2,
      lastCorrectElapsedMs: 6000,
      timeLimitSec: TIME_LIMIT,
      finished: false,
    })
    expect(result.normalizedScore).toBeGreaterThan(0)
    expect(result.finished).toBe(false)
  })

  test('어떤 입력에도 계약을 위반하지 않는다', () => {
    for (const correctCount of [0, 1, 3, PERFECT_COUNT, PERFECT_COUNT + 20]) {
      const result = computeResult({
        correctCount,
        lastCorrectElapsedMs: correctCount * 1000,
        timeLimitSec: TIME_LIMIT,
        finished: false,
      })
      expect(validateGameResult(result, 'sentenceCopy')).toEqual([])
    }
  })
})

/**
 * 몇 개를 쳐야 통과하고 몇 개면 만점인가.
 *
 * 세션은 3판 평균으로 벌칙을 정하므로 이 두 지점이 게임의 난이도 그 자체다.
 * 개수를 만점 기준으로 그냥 나누던 때에는 두 지점을 따로 정할 수 없었다 —
 * 지금은 통과선과 만점을 각각 못 박고 그 사이를 잇는다.
 */
describe('통과·만점 기준', () => {
  const scoreFor = (correctCount: number) =>
    computeResult({ correctCount, lastCorrectElapsedMs: 5000, timeLimitSec: 20, finished: true })
      .normalizedScore

  it('2개를 맞히면 통과선에 닿는다', () => {
    expect(PASS_COUNT).toBe(2)
    expect(scoreFor(PASS_COUNT)).toBe(PENALTY_THRESHOLD)
  })

  it('1개까지는 통과선을 못 넘는다', () => {
    expect(scoreFor(PASS_COUNT - 1)).toBeLessThan(PENALTY_THRESHOLD)
  })

  it('6개를 맞히면 만점이다', () => {
    expect(PERFECT_COUNT).toBe(6)
    expect(scoreFor(PERFECT_COUNT)).toBe(100)
  })

  it('통과선 아래는 0점에서 40점까지 고르게 오른다', () => {
    expect(scoreFor(0)).toBe(0)
    expect(scoreFor(1)).toBe(20)
    expect(scoreFor(2)).toBe(40)
  })

  it('통과선 위는 40점에서 100점까지 고르게 오른다', () => {
    expect(scoreFor(3)).toBe(55)
    expect(scoreFor(4)).toBe(70)
    expect(scoreFor(5)).toBe(85)
    expect(scoreFor(6)).toBe(100)
  })

  it('한 개라도 더 맞히면 점수가 반드시 오른다', () => {
    for (let n = 1; n <= PERFECT_COUNT; n++) {
      expect(scoreFor(n)).toBeGreaterThan(scoreFor(n - 1))
    }
  })

  it('만점을 넘겨도 100에서 멈춘다', () => {
    expect(scoreFor(PERFECT_COUNT + 7)).toBe(100)
  })
})
