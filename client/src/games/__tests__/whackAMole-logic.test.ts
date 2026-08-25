import {
  buildMoles,
  HOLE_COUNT,
  MOLE_COUNT,
  normalize,
} from '../whackAMole/logic'

const DURATION = 20_000

describe('buildMoles', () => {
  it('정해진 마리 수만큼 만든다', () => {
    expect(buildMoles(123, DURATION)).toHaveLength(MOLE_COUNT)
  })

  it('같은 시드는 완전히 같은 스케줄을 만든다', () => {
    expect(buildMoles(31337, DURATION)).toEqual(buildMoles(31337, DURATION))
  })

  it('다른 시드는 다른 스케줄을 만든다', () => {
    expect(buildMoles(1, DURATION)).not.toEqual(buildMoles(2, DURATION))
  })

  it('구멍은 항상 격자 범위 안이다', () => {
    for (const m of buildMoles(7, DURATION)) {
      expect(Number.isInteger(m.hole)).toBe(true)
      expect(m.hole).toBeGreaterThanOrEqual(0)
      expect(m.hole).toBeLessThan(HOLE_COUNT)
    }
  })

  it('등장 시각 순으로 정렬돼 있다', () => {
    const moles = buildMoles(55, DURATION)
    for (let i = 1; i < moles.length; i++) {
      expect(moles[i].showAtMs).toBeGreaterThanOrEqual(moles[i - 1].showAtMs)
    }
  })

  it('모든 두더지가 제한시간 안에 나왔다 들어간다', () => {
    for (const m of buildMoles(9, DURATION)) {
      expect(m.showAtMs).toBeGreaterThanOrEqual(0)
      expect(m.hideAtMs).toBeLessThanOrEqual(DURATION)
      expect(m.hideAtMs).toBeGreaterThan(m.showAtMs)
    }
  })

  it('같은 구멍에서 동시에 두 마리가 나오지 않는다', () => {
    // 겹치면 하나는 잡을 수가 없다.
    const moles = buildMoles(4242, DURATION)
    for (let i = 0; i < moles.length; i++) {
      for (let j = i + 1; j < moles.length; j++) {
        if (moles[i].hole !== moles[j].hole) continue
        const overlap =
          moles[i].showAtMs < moles[j].hideAtMs && moles[j].showAtMs < moles[i].hideAtMs
        expect(overlap).toBe(false)
      }
    }
  })

  it('여러 시드에서도 겹침이 없다', () => {
    for (const seed of [1, 2, 3, 99, 12345, 777777]) {
      const moles = buildMoles(seed, DURATION)
      const byHole = new Map<number, typeof moles>()
      for (const m of moles) {
        const list = byHole.get(m.hole) ?? []
        list.push(m)
        byHole.set(m.hole, list)
      }
      for (const list of byHole.values()) {
        const sorted = [...list].sort((a, b) => a.showAtMs - b.showAtMs)
        for (let i = 1; i < sorted.length; i++) {
          expect(sorted[i].showAtMs).toBeGreaterThanOrEqual(sorted[i - 1].hideAtMs)
        }
      }
    }
  })

  it('제한시간이 짧아도 그 안에 담긴다', () => {
    for (const m of buildMoles(5, 5_000)) {
      expect(m.hideAtMs).toBeLessThanOrEqual(5_000)
    }
  })

  it('후반 두더지가 초반보다 빨리 사라진다', () => {
    const moles = buildMoles(2024, DURATION)
    const dur = (m: (typeof moles)[number]) => m.hideAtMs - m.showAtMs
    const early = moles.slice(0, 6).reduce((s, m) => s + dur(m), 0) / 6
    const late = moles.slice(-6).reduce((s, m) => s + dur(m), 0) / 6
    expect(late).toBeLessThan(early)
  })
})

describe('normalize', () => {
  it('전부 잡으면 100이다', () => {
    expect(normalize(MOLE_COUNT)).toBe(100)
  })

  it('하나도 못 잡으면 0이다', () => {
    expect(normalize(0)).toBe(0)
  })

  it('절반 잡으면 50이다', () => {
    expect(normalize(MOLE_COUNT / 2)).toBe(50)
  })

  it('음수는 0으로 자른다', () => {
    expect(normalize(-3)).toBe(0)
  })

  it('마리 수를 초과해도 100을 넘지 않는다', () => {
    expect(normalize(MOLE_COUNT + 10)).toBe(100)
  })

  it('기준선 40점을 넘으려면 10마리가 필요하다', () => {
    expect(normalize(9)).toBeLessThan(40)
    expect(normalize(10)).toBeGreaterThanOrEqual(40)
  })
})
