import { PENALTY_THRESHOLD } from '../types'
import { BOMB_RATIO, HOLE_COLUMNS, HOLE_COUNT, HOLE_GAP, HOLE_SIZE, MAX_PER_WAVE, MIN_PER_WAVE, PASS_RATIO, TIME_LIMIT_SEC, VISIBLE_MAX_MS, VISIBLE_MIN_MS, WAVE_INTERVAL_MS, bombCountFor, buildSpawns, countMoles, holeAt, netScore, normalize } from '../whackAMole/logic'

const DURATION = TIME_LIMIT_SEC * 1000
const SEEDS = [1, 2, 3, 99, 12345, 777777, 2024]

describe('상수', () => {
  it('제한시간은 20초로 고정이다', () => {
    expect(TIME_LIMIT_SEC).toBe(20)
  })

  it('한 번에 1~2마리가 나온다', () => {
    expect(MIN_PER_WAVE).toBe(1)
    expect(MAX_PER_WAVE).toBe(2)
  })

  it('표시 시간은 0.5~1초다', () => {
    expect(VISIBLE_MIN_MS).toBe(500)
    expect(VISIBLE_MAX_MS).toBe(1000)
  })

  it('폭탄 비중은 등장물의 25%다', () => {
    // 총량이 20개이던 시절의 5개와 같은 비율. 총량이 늘어도 밀도가 유지된다.
    expect(BOMB_RATIO).toBe(0.25)
    expect(bombCountFor(20)).toBe(5)
  })
})

describe('buildSpawns', () => {
  it('웨이브마다 1~2개가 같은 순간에 나온다', () => {
    for (const seed of SEEDS) {
      const byShowAt = new Map<number, number>()
      for (const s of buildSpawns(seed, DURATION)) {
        byShowAt.set(s.showAtMs, (byShowAt.get(s.showAtMs) ?? 0) + 1)
      }
      for (const count of byShowAt.values()) {
        expect(count).toBeGreaterThanOrEqual(MIN_PER_WAVE)
        expect(count).toBeLessThanOrEqual(MAX_PER_WAVE)
      }
    }
  })

  it('두 마리가 같이 나오는 웨이브가 실제로 있다', () => {
    // 항상 1마리씩이면 "1~2 랜덤"이 아니다.
    const counts = new Map<number, number>()
    for (const s of buildSpawns(4242, DURATION)) {
      counts.set(s.showAtMs, (counts.get(s.showAtMs) ?? 0) + 1)
    }
    expect([...counts.values()]).toContain(2)
  })

  it('웨이브 수는 제한시간을 간격으로 나눈 값이다', () => {
    // 간격이 벌어지면 게임이 늘어지고, 좁아지면 몰아친다.
    for (const seed of SEEDS) {
      const moments = new Set(buildSpawns(seed, DURATION).map((s) => s.showAtMs))
      expect(moments.size).toBe(DURATION / WAVE_INTERVAL_MS)
    }
  })

  it('표시 시간이 0.5~1초 안에 있다', () => {
    for (const seed of SEEDS) {
      for (const s of buildSpawns(seed, DURATION)) {
        const visible = s.hideAtMs - s.showAtMs
        expect(visible).toBeGreaterThanOrEqual(VISIBLE_MIN_MS)
        expect(visible).toBeLessThanOrEqual(VISIBLE_MAX_MS)
      }
    }
  })

  it('폭탄이 총 등장물의 25%를 차지한다', () => {
    for (const seed of SEEDS) {
      const spawns = buildSpawns(seed, DURATION)
      const bombs = spawns.filter((s) => s.kind === 'bomb')
      expect(bombs).toHaveLength(bombCountFor(spawns.length))
      expect(bombs.length / spawns.length).toBeCloseTo(BOMB_RATIO, 1)
    }
  })

  it('총 등장물이 늘면 폭탄도 같이 는다', () => {
    // 개수로 고정하면 판이 커질수록 폭탄이 묽어져 난이도가 떨어진다.
    expect(bombCountFor(40)).toBeGreaterThan(bombCountFor(20))
  })

  it('두더지가 한 마리도 없는 판은 안 나온다', () => {
    // 비율이 1에 가까워도 분모가 0이 되면 점수가 항상 0이 된다.
    expect(bombCountFor(1)).toBeLessThan(1)
    expect(bombCountFor(2)).toBeLessThan(2)
  })

  it('두더지 수는 시드마다 다를 수 있다', () => {
    // 이래서 점수를 고정값이 아니라 실제로 나온 수로 나눈다.
    const totals = new Set(SEEDS.map((seed) => countMoles(buildSpawns(seed, DURATION))))
    expect(totals.size).toBeGreaterThan(1)
  })

  it('같은 시드는 완전히 같은 스케줄을 만든다', () => {
    expect(buildSpawns(31337, DURATION)).toEqual(buildSpawns(31337, DURATION))
  })

  it('다른 시드는 다른 스케줄을 만든다', () => {
    expect(buildSpawns(1, DURATION)).not.toEqual(buildSpawns(2, DURATION))
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
    for (const seed of SEEDS) {
      for (const s of buildSpawns(seed, DURATION)) {
        expect(s.showAtMs).toBeGreaterThanOrEqual(0)
        expect(s.hideAtMs).toBeLessThanOrEqual(DURATION)
        expect(s.hideAtMs).toBeGreaterThan(s.showAtMs)
      }
    }
  })

  it('같은 구멍에서 동시에 두 개가 나오지 않는다', () => {
    // 겹치면 하나는 칠 수가 없다. 폭탄과 두더지가 겹치면 특히 억울하다.
    for (const seed of SEEDS) {
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
})

describe('normalize', () => {
  const MOLES = 25

  it('전부 잡으면 100이다', () => {
    expect(normalize(MOLES, MOLES)).toBe(100)
  })

  it('하나도 못 잡으면 0이다', () => {
    expect(normalize(0, MOLES)).toBe(0)
  })

  it('절반 잡으면 50이다', () => {
    expect(normalize(MOLES / 2, MOLES)).toBe(50)
  })

  it('음수는 0으로 자른다', () => {
    expect(normalize(-3, MOLES)).toBe(0)
  })

  it('마리 수를 초과해도 100을 넘지 않는다', () => {
    expect(normalize(MOLES + 10, MOLES)).toBe(100)
  })

  it('두더지가 안 나왔으면 0이다', () => {
    // 0으로 나누면 NaN이 나가고 계약(0~100)이 깨진다.
    expect(normalize(0, 0)).toBe(0)
  })

  it('나온 두더지의 40%를 잡으면 기준선에 정확히 닿는다', () => {
    // 총량이 시드마다 달라도 통과선은 항상 "나온 것의 40%"다.
    for (const moles of [15, 22, 25, 31, 40]) {
      expect(normalize(moles * PASS_RATIO, moles)).toBeCloseTo(PENALTY_THRESHOLD, 10)
    }
  })

  it('실제 스케줄에서도 40% 잡으면 통과한다', () => {
    for (const seed of SEEDS) {
      const moles = countMoles(buildSpawns(seed, DURATION))
      const needed = Math.ceil(moles * PASS_RATIO)
      expect(normalize(needed - 1, moles)).toBeLessThan(PENALTY_THRESHOLD)
      expect(normalize(needed, moles)).toBeGreaterThanOrEqual(PENALTY_THRESHOLD)
    }
  })
})

/**
 * 좌표로 구멍을 찾는다.
 *
 * 구멍마다 Pressable 을 두면 두 번째 손가락이 통째로 버려진다 — React Native 의
 * 응답자(responder)는 전역에 하나뿐이라, 이미 응답자가 있으면 형제 노드는
 * 후보에서 잘려 나간다. 두더지는 한 번에 두 마리까지 올라오므로 그러면 동시에
 * 잡을 수가 없다. 그리드 하나가 모든 손가락을 받고 좌표로 구멍을 찾는다.
 */
describe('holeAt', () => {
  const step = HOLE_SIZE + HOLE_GAP

  it('각 구멍의 한가운데를 제 번호로 찾는다', () => {
    for (let hole = 0; hole < HOLE_COUNT; hole++) {
      const row = Math.floor(hole / HOLE_COLUMNS)
      const col = hole % HOLE_COLUMNS
      const x = col * step + HOLE_SIZE / 2
      const y = row * step + HOLE_SIZE / 2
      expect(holeAt(x, y)).toBe(hole)
    }
  })

  it('구멍의 네 모서리도 그 구멍으로 친다', () => {
    // 화면에서는 둥글게 보이지만 예전 Pressable 도 사각 영역 전체가 눌렸다.
    // 모서리를 빼면 갑자기 더 어려워진다.
    expect(holeAt(0, 0)).toBe(0)
    expect(holeAt(HOLE_SIZE - 1, HOLE_SIZE - 1)).toBe(0)
  })

  it('구멍 사이 여백은 아무 것도 아니다', () => {
    // 여백까지 먹으면 대충 문질러도 잡힌다.
    expect(holeAt(HOLE_SIZE + HOLE_GAP / 2, HOLE_SIZE / 2)).toBeNull()
    expect(holeAt(HOLE_SIZE / 2, HOLE_SIZE + HOLE_GAP / 2)).toBeNull()
  })

  it('그리드 밖은 null이다', () => {
    expect(holeAt(-1, 10)).toBeNull()
    expect(holeAt(10, -1)).toBeNull()
    expect(holeAt(step * HOLE_COLUMNS + 5, 10)).toBeNull()
    expect(holeAt(10, step * 3 + 5)).toBeNull()
  })

  it('좌표가 수가 아니면 null이다', () => {
    // 마우스 이벤트에서 좌표가 안 넘어오는 경우가 있다.
    expect(holeAt(NaN, 10)).toBeNull()
    expect(holeAt(10, undefined as unknown as number)).toBeNull()
  })

  it('서로 다른 두 점이 서로 다른 구멍을 가리킨다', () => {
    // 동시 터치가 의미를 가지려면 이게 성립해야 한다.
    const first = holeAt(HOLE_SIZE / 2, HOLE_SIZE / 2)
    const second = holeAt(step + HOLE_SIZE / 2, step + HOLE_SIZE / 2)
    expect(first).not.toBe(second)
    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
  })
})
