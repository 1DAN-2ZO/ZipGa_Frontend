import {
  CAT_QUEUE_LENGTH,
  computeResult,
  EASY_COLORS,
  HARD_COLORS,
  LEFT_COLORS,
  makeCats,
  PERFECT_COUNT,
  WRONG_PENALTY,
  RAMP_AT,
  RIGHT_COLORS,
  sideOf,
} from '../leftRight/logic'
import { validateGameResult } from '../types'

describe('makeCats', () => {
  it('같은 시드는 완전히 같은 고양이 줄을 만든다', () => {
    expect(makeCats(31337, 40)).toEqual(makeCats(31337, 40))
  })

  it('다른 시드는 다른 줄을 만든다', () => {
    expect(makeCats(1, 40)).not.toEqual(makeCats(2, 40))
  })

  it('요청한 수만큼 만든다', () => {
    expect(makeCats(7, 12)).toHaveLength(12)
  })

  it('앞부분은 쉬운 두 색만 나온다', () => {
    // 첫 판부터 네 색이 나오면 규칙을 읽기도 전에 틀린다.
    for (const seed of [1, 2, 3, 99, 12345]) {
      const opening = makeCats(seed, RAMP_AT).slice(0, RAMP_AT)
      for (const color of opening) {
        expect(EASY_COLORS).toContain(color)
      }
    }
  })

  it('RAMP_AT 이후에는 네 색이 모두 나온다', () => {
    const later = makeCats(4242, 200).slice(RAMP_AT)
    for (const color of HARD_COLORS) {
      expect(later).toContain(color)
    }
  })

  it('쉬운 구간에서도 두 색이 모두 나온다', () => {
    // 한 색으로만 채워지면 좌우 판단이 사라진다.
    const opening = makeCats(4242, 200).slice(0, RAMP_AT)
    for (const color of EASY_COLORS) {
      expect(opening).toContain(color)
    }
  })

  it('한쪽으로 심하게 치우치지 않는다', () => {
    // 좌우가 거의 안 섞이면 버튼 하나만 누르는 게 최적이 된다.
    const cats = makeCats(20260825, CAT_QUEUE_LENGTH).slice(RAMP_AT)
    const leftShare = cats.filter((c) => sideOf(c) === 'left').length / cats.length
    expect(leftShare).toBeGreaterThan(0.3)
    expect(leftShare).toBeLessThan(0.7)
  })
})

describe('sideOf', () => {
  it('검정과 빨강은 왼쪽이다', () => {
    for (const color of LEFT_COLORS) {
      expect(sideOf(color)).toBe('left')
    }
  })

  it('흰색과 파랑은 오른쪽이다', () => {
    for (const color of RIGHT_COLORS) {
      expect(sideOf(color)).toBe('right')
    }
  })

  it('네 색이 좌우로 빠짐없이 갈린다', () => {
    expect([...LEFT_COLORS, ...RIGHT_COLORS].sort()).toEqual([...HARD_COLORS].sort())
  })
})

describe('computeResult', () => {
  const base = { lastCorrectElapsedMs: 5_000, timeLimitSec: 20, finished: true }

  it('틀리면 한 마리씩 깎는다', () => {
    expect(WRONG_PENALTY).toBe(1)
  })

  it('기준 개수를 채우면 100점이다', () => {
    expect(computeResult({ ...base, netScore: PERFECT_COUNT }).normalizedScore).toBe(100)
  })

  it('기준을 넘겨도 100점을 넘지 않는다', () => {
    expect(computeResult({ ...base, netScore: PERFECT_COUNT * 3 }).normalizedScore).toBe(100)
  })

  it('절반을 맞히면 50점이다', () => {
    expect(computeResult({ ...base, netScore: PERFECT_COUNT / 2 }).normalizedScore).toBe(50)
  })

  it('한 마리도 못 보내면 0점이다', () => {
    expect(computeResult({ ...base, netScore: 0 }).normalizedScore).toBe(0)
  })

  it('많이 틀려 점수가 음수여도 0점 밑으로는 안 내려간다', () => {
    // normalizedScore가 음수면 계약(0~100) 위반이다.
    expect(computeResult({ ...base, netScore: -9 }).normalizedScore).toBe(0)
  })

  it('score는 맞힌 수에서 틀린 수를 뺀 값 그대로다', () => {
    // 화면에 보이는 원점수다. 음수도 그대로 보여준다.
    expect(computeResult({ ...base, netScore: 7 }).score).toBe(7)
    expect(computeResult({ ...base, netScore: -3 }).score).toBe(-3)
  })

  it('동점 판별에는 마지막 정답까지 걸린 시간을 쓴다', () => {
    expect(computeResult({ ...base, netScore: 7 }).tiebreakMs).toBe(5_000)
  })

  it('점수가 0 이하면 가장 느린 사람으로 둔다', () => {
    // 0으로 두면 꼴찌가 동점 1등이 된다.
    expect(computeResult({ ...base, netScore: 0 }).tiebreakMs).toBe(20_000)
    expect(computeResult({ ...base, netScore: -5 }).tiebreakMs).toBe(20_000)
  })

  it('어떤 입력에도 계약을 위반하지 않는다', () => {
    for (const netScore of [-PERFECT_COUNT * 2, -1, 0, 1, PERFECT_COUNT, PERFECT_COUNT * 10]) {
      for (const finished of [true, false]) {
        const result = computeResult({ ...base, netScore, finished })
        expect(validateGameResult(result, 'leftRight')).toEqual([])
      }
    }
  })
})
