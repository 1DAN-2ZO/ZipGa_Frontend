import {
  BOMB_COUNT,
  buildSpawns,
  HOLE_COUNT,
  MOLE_COUNT,
  netScore,
  normalize,
  SPAWN_COUNT,
} from '../whackAMole/logic'

const DURATION = 20_000

describe('상수', () => {
  it('등장물은 두더지와 폭탄의 합이다', () => {
    expect(SPAWN_COUNT).toBe(MOLE_COUNT + BOMB_COUNT)
  })

  it('폭탄은 5개다', () => {
    expect(BOMB_COUNT).toBe(5)
  })

  it('등장 간격이 1초가 되도록 총량이 제한시간과 맞는다', () => {
    // 간격이 벌어지면 게임이 늘어지고, 좁아지면 몰아친다.
    expect(DURATION / SPAWN_COUNT).toBe(1000)
  })
})

describe('buildSpawns', () => {
  it('정해진 수만큼 만든다', () => {
    expect(buildSpawns(123, DURATION)).toHaveLength(SPAWN_COUNT)
  })

  it('폭탄과 두더지 개수가 정확하다', () => {
    const spawns = buildSpawns(123, DURATION)
    expect(spawns.filter((s) => s.kind === 'bomb')).toHaveLength(BOMB_COUNT)
    expect(spawns.filter((s) => s.kind === 'mole')).toHaveLength(MOLE_COUNT)
  })

  it('같은 시드는 완전히 같은 스케줄을 만든다', () => {
    expect(buildSpawns(31337, DURATION)).toEqual(buildSpawns(31337, DURATION))
  })

  it('다른 시드는 다른 스케줄을 만든다', () => {
    expect(buildSpawns(1, DURATION)).not.toEqual(buildSpawns(2, DURATION))
  })

  it('시드가 다르면 폭탄 위치도 달라진다', () => {
    const bombsOf = (seed: number) =>
      buildSpawns(seed, DURATION)
        .map((s, i) => (s.kind === 'bomb' ? i : -1))
        .filter((i) => i >= 0)
    expect(bombsOf(11)).not.toEqual(bombsOf(22))
  })

  it('구멍은 항상 격자 범위 안이다', () => {
    for (const s of buildSpawns(7, DURATION)) {
      expect(Number.isInteger(s.hole)).toBe(true)
      expect(s.hole).toBeGreaterThanOrEqual(0)
      expect(s.hole).toBeLessThan(HOLE_COUNT)
    }
  })

  it('등장 시각 순으로 정렬돼 있다', () => {
    const spawns = buildSpawns(55, DURATION)
    for (let i = 1; i < spawns.length; i++) {
      expect(spawns[i].showAtMs).toBeGreaterThanOrEqual(spawns[i - 1].showAtMs)
    }
  })

  it('모두 제한시간 안에 나왔다 들어간다', () => {
    for (const s of buildSpawns(9, DURATION)) {
      expect(s.showAtMs).toBeGreaterThanOrEqual(0)
      expect(s.hideAtMs).toBeLessThanOrEqual(DURATION)
      expect(s.hideAtMs).toBeGreaterThan(s.showAtMs)
    }
  })

  it('같은 구멍에서 동시에 두 개가 나오지 않는다', () => {
    // 겹치면 하나는 칠 수가 없다. 폭탄과 두더지가 겹치면 특히 억울하다.
    for (const seed of [1, 2, 3, 99, 12345, 777777]) {
      const spawns = buildSpawns(seed, DURATION)
      for (let i = 0; i < spawns.length; i++) {
        for (let j = i + 1; j < spawns.length; j++) {
          if (spawns[i].hole !== spawns[j].hole) continue
          const overlap =
            spawns[i].showAtMs < spawns[j].hideAtMs && spawns[j].showAtMs < spawns[i].hideAtMs
          expect(overlap).toBe(false)
        }
      }
    }
  })

  it('제한시간이 짧아도 그 안에 담긴다', () => {
    for (const s of buildSpawns(5, 5_000)) {
      expect(s.hideAtMs).toBeLessThanOrEqual(5_000)
    }
  })

  it('후반 등장물이 초반보다 빨리 사라진다', () => {
    const spawns = buildSpawns(2024, DURATION)
    const dur = (s: (typeof spawns)[number]) => s.hideAtMs - s.showAtMs
    const early = spawns.slice(0, 4).reduce((n, s) => n + dur(s), 0) / 4
    const late = spawns.slice(-4).reduce((n, s) => n + dur(s), 0) / 4
    expect(late).toBeLessThan(early)
  })
})

describe('netScore', () => {
  it('폭탄을 안 치면 잡은 수 그대로다', () => {
    expect(netScore(5, 0)).toBe(5)
  })

  it('폭탄 하나당 1점씩 깎는다', () => {
    expect(netScore(5, 2)).toBe(3)
  })

  it('0 아래로는 안 내려간다', () => {
    expect(netScore(1, 3)).toBe(0)
    expect(netScore(0, 3)).toBe(0)
  })

  it('폭탄 셋을 다 쳐도 만회할 수 있다', () => {
    // -2 였다면 12마리 중 만회가 불가능해진다.
    expect(netScore(MOLE_COUNT, BOMB_COUNT)).toBe(MOLE_COUNT - BOMB_COUNT)
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

  it('기준선 40점을 넘으려면 전체의 40%가 필요하다', () => {
    const needed = Math.ceil(MOLE_COUNT * 0.4)
    expect(normalize(needed - 1)).toBeLessThan(40)
    expect(normalize(needed)).toBeGreaterThanOrEqual(40)
  })
})
