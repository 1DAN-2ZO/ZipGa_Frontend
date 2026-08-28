import {
  accuracyOf,
  ALL_COLORS,
  CAT_QUEUE_LENGTH,
  computeResult,
  makeCats,
  makeLineup,
  MIN_ACCURACY,
  MIN_CORRECT,
  normalize,
  PERFECT_COUNT,
  WRONG_PENALTY,
  RAMP_AT,
  sideOf,
} from '../leftRight/logic'
import { PENALTY_THRESHOLD, validateGameResult } from '../types'

const SEEDS = [1, 2, 3, 7, 99, 4242, 12345, 20260827, 31337]

describe('makeLineup', () => {
  it('같은 시드는 같은 배치를 만든다', () => {
    // 서버는 시드만 내려준다. 폰마다 배치가 다르면 같은 게임이 아니다.
    expect(makeLineup(4242)).toEqual(makeLineup(4242))
  })

  it('시드가 바뀌면 배치도 바뀐다', () => {
    // 색이 늘 같은 쪽이면 몇 판 만에 문지기를 안 보고 손이 먼저 나간다.
    const seen = new Set(SEEDS.map((s) => makeLineup(s).left.join(',')))
    expect(seen.size).toBeGreaterThan(1)
  })

  it('좌우가 항상 2:2다', () => {
    // 한쪽이 3색이면 그 판은 한 방향으로 쏠려 찍기가 유리해진다.
    for (const seed of SEEDS) {
      const { left, right } = makeLineup(seed)
      expect(left).toHaveLength(2)
      expect(right).toHaveLength(2)
    }
  })

  it('네 색이 빠짐없이 한 번씩만 배치된다', () => {
    for (const seed of SEEDS) {
      const { left, right } = makeLineup(seed)
      expect([...left, ...right].sort()).toEqual([...ALL_COLORS].sort())
    }
  })

  it('초반 두 색은 반드시 서로 반대쪽이다', () => {
    // 같은 쪽 두 색이 걸리면 앞 여덟 마리가 전부 한 방향이라
    // 좌우 감각을 잡는 구간이 통째로 무의미해진다.
    for (const seed of SEEDS) {
      const lineup = makeLineup(seed)
      const [a, b] = lineup.easy
      expect(sideOf(lineup, a)).not.toBe(sideOf(lineup, b))
    }
  })
})

describe('sideOf', () => {
  it('그 판의 배치대로 좌우를 답한다', () => {
    for (const seed of SEEDS) {
      const lineup = makeLineup(seed)
      for (const color of lineup.left) expect(sideOf(lineup, color)).toBe('left')
      for (const color of lineup.right) expect(sideOf(lineup, color)).toBe('right')
    }
  })

  it('같은 색이라도 판이 다르면 방향이 달라질 수 있다', () => {
    // 고정 매핑을 없앤 것이 이 게임의 요점이다.
    const sides = new Set(SEEDS.map((s) => sideOf(makeLineup(s), 'black')))
    expect(sides.size).toBe(2)
  })
})

describe('makeCats', () => {
  const catsFor = (seed: number, count: number) => makeCats(seed, count, makeLineup(seed))

  it('같은 시드는 완전히 같은 고양이 줄을 만든다', () => {
    expect(catsFor(31337, 40)).toEqual(catsFor(31337, 40))
  })

  it('다른 시드는 다른 줄을 만든다', () => {
    expect(catsFor(1, 40)).not.toEqual(catsFor(2, 40))
  })

  it('요청한 수만큼 만든다', () => {
    expect(catsFor(7, 12)).toHaveLength(12)
  })

  it('앞부분은 그 판의 쉬운 두 색만 나온다', () => {
    // 첫 판부터 네 색이 나오면 규칙을 읽기도 전에 틀린다.
    for (const seed of SEEDS) {
      const lineup = makeLineup(seed)
      for (const color of makeCats(seed, RAMP_AT, lineup)) {
        expect(lineup.easy).toContain(color)
      }
    }
  })

  it('RAMP_AT 이후에는 네 색이 모두 나온다', () => {
    const later = catsFor(4242, 200).slice(RAMP_AT)
    for (const color of ALL_COLORS) {
      expect(later).toContain(color)
    }
  })

  it('쉬운 구간에서도 두 색이 모두 나온다', () => {
    // 한 색으로만 채워지면 좌우 판단이 사라진다.
    const lineup = makeLineup(4242)
    const opening = makeCats(4242, 200, lineup).slice(0, RAMP_AT)
    for (const color of lineup.easy) {
      expect(opening).toContain(color)
    }
  })

  it('한쪽으로 심하게 치우치지 않는다', () => {
    // 좌우가 거의 안 섞이면 버튼 하나만 누르는 게 최적이 된다.
    const seed = 20260825
    const lineup = makeLineup(seed)
    const cats = makeCats(seed, CAT_QUEUE_LENGTH, lineup).slice(RAMP_AT)
    const leftShare = cats.filter((c) => sideOf(lineup, c) === 'left').length / cats.length
    expect(leftShare).toBeGreaterThan(0.3)
    expect(leftShare).toBeLessThan(0.7)
  })

  it('배치가 바뀌어도 좌우 비율은 치우치지 않는다', () => {
    // 2:2를 지키므로 어느 시드에서든 성립해야 한다.
    for (const seed of SEEDS) {
      const lineup = makeLineup(seed)
      const cats = makeCats(seed, CAT_QUEUE_LENGTH, lineup).slice(RAMP_AT)
      const leftShare = cats.filter((c) => sideOf(lineup, c) === 'left').length / cats.length
      expect(leftShare).toBeGreaterThan(0.3)
      expect(leftShare).toBeLessThan(0.7)
    }
  })
})

describe('normalize — 통과 조건', () => {
  // 통과선은 games/types.ts의 PENALTY_THRESHOLD(40)다.
  // 두 관문을 다 넘어야 여기에 닿는다: 최소 30개 정답 + 정확도 70% 이상.

  it('30개를 맞히고 정확도 70%면 딱 통과선이다', () => {
    // 30 맞고 12 틀리면 30/42 = 71.4%
    expect(normalize(MIN_CORRECT, 12)).toBeGreaterThanOrEqual(PENALTY_THRESHOLD)
  })

  it('29개까지는 아무리 정확해도 통과선을 못 넘는다', () => {
    // 하나도 안 틀려 정확도 100%여도 개수가 모자라면 안 된다.
    expect(normalize(MIN_CORRECT - 1, 0)).toBeLessThan(PENALTY_THRESHOLD)
  })

  it('개수를 채워도 정확도가 기준 미만이면 통과선을 못 넘는다', () => {
    // 개수는 채웠지만 그만큼 틀렸다 — 아무 쪽이나 빠르게 누른 경우다.
    expect(accuracyOf(MIN_CORRECT, MIN_CORRECT)).toBeLessThan(MIN_ACCURACY)
    expect(normalize(MIN_CORRECT, MIN_CORRECT)).toBeLessThan(PENALTY_THRESHOLD)
  })

  it('두 조건을 다 못 넘기면 더 부족한 쪽을 따른다', () => {
    // 10개(절반) · 정확도 50%(기준의 83%) → 개수가 더 모자라다
    expect(normalize(10, 10)).toBeLessThan(PENALTY_THRESHOLD * 0.6)
  })

  it('한 번도 안 누르면 0점이다', () => {
    expect(normalize(0, 0)).toBe(0)
  })

  it('기준 수를 채우면 100점이다', () => {
    expect(normalize(PERFECT_COUNT, 0)).toBe(100)
  })

  it('기준 수를 넘겨도 100에서 멈춘다', () => {
    expect(normalize(PERFECT_COUNT + 20, 0)).toBe(100)
  })

  it('통과선과 100 사이에서는 개수만큼 올라간다', () => {
    // 두 상수 사이에서 잡는다 — 문턱을 조정해도 이 검사가 저절로 따라온다
    const low = normalize(MIN_CORRECT + 1, 0)
    const high = normalize(PERFECT_COUNT - 1, 0)
    expect(low).toBeGreaterThan(PENALTY_THRESHOLD)
    expect(high).toBeGreaterThan(low)
    expect(high).toBeLessThan(100)
  })

  it('통과선과 만점 사이가 계단이 되지 않는다', () => {
    // 한 마리에 몇 점씩 뛰는지. 폭이 좁으면 한 마리 차이로 점수가 널뛴다.
    const perCat = (100 - PENALTY_THRESHOLD) / (PERFECT_COUNT - MIN_CORRECT)
    expect(perCat).toBeLessThanOrEqual(10)
  })

  it('언제나 0~100 안에 있다', () => {
    // 계약이 요구하는 범위다.
    for (const [c, w] of [[0, 50], [50, 0], [1, 99], [99, 1], [0, 0]]) {
      const v = normalize(c, w)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(100)
    }
  })
})

describe('computeResult', () => {
  const base = { lastCorrectElapsedMs: 12000, timeLimitSec: 20, finished: true }

  it('기준 수를 채우면 100점이다', () => {
    const result = computeResult({ correct: PERFECT_COUNT, wrong: 0, ...base })
    expect(result.normalizedScore).toBe(100)
    expect(validateGameResult(result, 'leftRight')).toEqual([])
  })

  it('화면에 보이는 원점수는 순점수 그대로다', () => {
    // 많이 틀리면 음수로 남는다. 정규화만 0에서 멈춘다.
    const result = computeResult({ correct: 2, wrong: 7, ...base })
    expect(result.score).toBe(2 - 7 * WRONG_PENALTY)
    expect(result.normalizedScore).toBeGreaterThanOrEqual(0)
    expect(validateGameResult(result, 'leftRight')).toEqual([])
  })

  it('한 개도 못 맞혔으면 가장 느린 사람으로 둔다', () => {
    // 0으로 두면 꼴찌가 동점 1등이 된다.
    const result = computeResult({ correct: 0, wrong: 5, ...base })
    expect(result.tiebreakMs).toBe(20000)
  })

  it('맞힌 게 있으면 마지막 정답 시각을 쓴다', () => {
    const result = computeResult({ correct: 25, wrong: 2, ...base })
    expect(result.tiebreakMs).toBe(12000)
  })
})
