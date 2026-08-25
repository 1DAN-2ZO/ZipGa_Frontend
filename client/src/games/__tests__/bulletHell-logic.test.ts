import {
  ARENA_MARGIN,
  advance,
  buildWaves,
  CENTER_CLEARANCE_RATIO,
  CENTER_CROWD_LIMIT,
  closestApproachToCenter,
  computeResult,
  isHit,
  closestApproach,
  HOMING_PER_WAVE_MAX,
  HOMING_RANGE_IN_RADII,
  HOMING_TURN_RATE,
  MAX_BULLETS_PER_WAVE,
  PLAYER_HITBOX_RATIO,
  steerToward,
  SURVIVE_TO_PASS_SEC,
  TIME_LIMIT_SEC,
  type Bullet,
} from '../bulletHell/logic'
import { PENALTY_THRESHOLD, validateGameResult } from '../types'

const ARENA = { width: 400, height: 700 }
const DURATION_MS = TIME_LIMIT_SEC * 1000

const allBullets = (seed: number) => buildWaves(seed, ARENA, DURATION_MS).flatMap((w) => w.bullets)

/**
 * 한 자리에 가만히 선 채로 몇 ms를 버티는지 실제로 굴려본다.
 *
 * 화면 없이 순수 함수만으로 한 판을 재생한다 — 유도까지 포함해서
 * "여기 서 있으면 안 맞는다"는 자리가 남아 있는지 직접 확인하는 용도다.
 */
const survivalOf = (seed: number, spot: { x: number; y: number }) => {
  const waves = buildWaves(seed, ARENA, DURATION_MS)
  const STEP_MS = 1000 / 60
  let bullets: Bullet[] = []
  let spawnedUpTo = 0

  for (let elapsed = 0; elapsed < DURATION_MS; elapsed += STEP_MS) {
    const due = waves.filter((w) => w.atMs > spawnedUpTo && w.atMs <= elapsed)
    spawnedUpTo = elapsed
    bullets = advance(
      steerToward([...bullets, ...due.flatMap((w) => w.bullets)], spot, STEP_MS / 1000),
      STEP_MS / 1000,
      ARENA,
    )
    if (isHit(spot, bullets, ARENA)) return elapsed
  }
  return DURATION_MS
}

describe('buildWaves', () => {
  it('같은 시드는 완전히 같은 탄막을 만든다', () => {
    expect(buildWaves(31337, ARENA, DURATION_MS)).toEqual(buildWaves(31337, ARENA, DURATION_MS))
  })

  it('다른 시드는 다른 탄막을 만든다', () => {
    expect(buildWaves(1, ARENA, DURATION_MS)).not.toEqual(buildWaves(2, ARENA, DURATION_MS))
  })

  it('웨이브가 시간순으로 정렬돼 있다', () => {
    const times = buildWaves(7, ARENA, DURATION_MS).map((w) => w.atMs)
    expect([...times].sort((a, b) => a - b)).toEqual(times)
  })

  it('제한시간을 넘겨서 나오는 웨이브는 없다', () => {
    for (const wave of buildWaves(7, ARENA, DURATION_MS)) {
      expect(wave.atMs).toBeLessThan(DURATION_MS)
    }
  })

  it('제한시간 내내 쉬지 않고 나온다', () => {
    const times = buildWaves(7, ARENA, DURATION_MS).map((w) => w.atMs)
    expect(times[0]).toBeLessThan(1500)
    expect(Math.max(...times)).toBeGreaterThan(DURATION_MS * 0.8)
  })

  it('모든 총알이 화면 밖에서 시작한다 — 눈앞에서 튀어나오면 피할 수 없다', () => {
    const inside = allBullets(7).filter(
      (b) => b.x > 0 && b.x < ARENA.width && b.y > 0 && b.y < ARENA.height,
    )
    expect(inside).toEqual([])
  })

  it('모든 총알이 화면 안을 지나간다 — 스치지도 못하고 사라지는 탄은 없다', () => {
    // 중심을 향하는지로 재면 구석을 겨냥한 탄이 억울하게 걸린다.
    // 실제로 날려보고 화면 안에 한 번이라도 들어오는지를 본다.
    const STEP = 1 / 30
    const inside = (b: Bullet) =>
      b.x >= 0 && b.x <= ARENA.width && b.y >= 0 && b.y <= ARENA.height

    for (const bullet of allBullets(7)) {
      let current = bullet
      let entered = false
      for (let t = 0; t < 8 && !entered; t += STEP) {
        current = advance([current], STEP)[0]
        entered = inside(current)
      }
      expect(entered).toBe(true)
    }
  })

  it('총알이 사방팔방에서 나온다 — 한쪽에서만 오지 않는다', () => {
    const center = { x: ARENA.width / 2, y: ARENA.height / 2 }
    const quadrants = new Set(
      allBullets(7).map((b) => `${b.x < center.x ? 'L' : 'R'}${b.y < center.y ? 'T' : 'B'}`),
    )
    expect(quadrants.size).toBe(4)
  })

  it('뒤로 갈수록 총알이 촘촘해진다', () => {
    const waves = buildWaves(7, ARENA, DURATION_MS)
    const half = Math.floor(waves.length / 2)
    const countIn = (ws: typeof waves) => ws.reduce((n, w) => n + w.bullets.length, 0)

    expect(countIn(waves.slice(half))).toBeGreaterThan(countIn(waves.slice(0, half)))
  })

  it('한 웨이브가 화면을 꽉 채울 만큼 쏟아지지는 않는다', () => {
    for (const wave of buildWaves(7, ARENA, DURATION_MS)) {
      expect(wave.bullets.length).toBeLessThanOrEqual(MAX_BULLETS_PER_WAVE)
    }
  })

  it('가운데가 상시 함정은 아니다', () => {
    const clearance = CENTER_CLEARANCE_RATIO * Math.min(ARENA.width, ARENA.height)
    for (const seed of [1, 7, 99, 4242, 31337]) {
      for (const wave of buildWaves(seed, ARENA, DURATION_MS)) {
        const throughCenter = wave.bullets.filter(
          (b) => closestApproachToCenter(b, ARENA) < clearance,
        )
        expect(throughCenter.length).toBeLessThanOrEqual(CENTER_CROWD_LIMIT)
      }
    }
  })

  it('총알이 느긋하게 날아온다', () => {
    // 화면 대각선을 건너는 데 최소 이만큼은 걸려야 눈으로 좇을 수 있다.
    const diagonal = Math.hypot(ARENA.width, ARENA.height)
    const fastest = Math.max(...allBullets(7).map((b) => Math.hypot(b.vx, b.vy)))

    expect(fastest / diagonal).toBeLessThanOrEqual(0.3)
  })

  it('한 판에 쏟아지는 총알 총량이 과하지 않다', () => {
    expect(allBullets(7).length).toBeLessThanOrEqual(220)
  })
})

describe('closestApproachToCenter', () => {
  it('한가운데를 향해 날아오는 총알은 0에 가깝다', () => {
    const bullet: Bullet = { x: 0, y: ARENA.height / 2, vx: 100, vy: 0, radius: 5 }
    expect(closestApproachToCenter(bullet, ARENA)).toBeCloseTo(0)
  })

  it('비껴 지나가는 총알은 비껴간 거리만큼 나온다', () => {
    const bullet: Bullet = { x: 0, y: ARENA.height / 2 - 80, vx: 100, vy: 0, radius: 5 }
    expect(closestApproachToCenter(bullet, ARENA)).toBeCloseTo(80)
  })

  it('멀어지는 중인 총알은 지나온 거리가 아니라 지금 거리를 쓴다', () => {
    // 이미 지나간 총알을 "중앙을 스친다"고 세면 함정 판정이 틀어진다.
    const bullet: Bullet = { x: ARENA.width / 2, y: ARENA.height / 2, vx: -100, vy: 0, radius: 5 }
    const past: Bullet = { ...bullet, x: -200 }
    expect(closestApproachToCenter(past, ARENA)).toBeCloseTo(ARENA.width / 2 + 200)
  })

  it('총알 크기와 속도가 화면 크기에 비례한다 — 기기가 달라도 난이도가 같다', () => {
    const small = buildWaves(7, { width: 200, height: 350 }, DURATION_MS)[0].bullets[0]
    const large = buildWaves(7, { width: 400, height: 700 }, DURATION_MS)[0].bullets[0]

    expect(large.radius).toBeCloseTo(small.radius * 2)
    expect(Math.hypot(large.vx, large.vy)).toBeCloseTo(Math.hypot(small.vx, small.vy) * 2)
  })
})

/**
 * 대충 피하는 사람. 한 걸음 앞을 보고 총알에서 멀어지는 쪽으로 움직인다.
 *
 * 사람보다 훨씬 서툴다. 이 정도로도 살아남는다면 사람은 당연히 살 수 있다.
 */
const dodgerSurvival = (seed: number) => {
  const waves = buildWaves(seed, ARENA, DURATION_MS)
  const STEP_MS = 1000 / 60
  const dt = STEP_MS / 1000
  const moveSpeed = Math.hypot(ARENA.width, ARENA.height) * 0.55

  let bullets: Bullet[] = []
  let spawnedUpTo = 0
  let me = { x: ARENA.width / 2, y: ARENA.height / 2 }

  for (let elapsed = 0; elapsed < DURATION_MS; elapsed += STEP_MS) {
    const due = waves.filter((w) => w.atMs > spawnedUpTo && w.atMs <= elapsed)
    spawnedUpTo = elapsed
    // 유도는 일부러 빼고 굴린다. 유도탄은 "한 걸음 앞만 보는" 이 봇을 정확히 겨냥해
    // 무력화하므로, 봇이 죽었다고 사람도 못 피한다는 뜻이 되지 않는다.
    // 여기서 재는 것은 직진탄의 밀도와 속도가 피할 만한가다.
    bullets = advance([...bullets, ...due.flatMap((w) => w.bullets)], dt, ARENA)
    if (isHit(me, bullets, ARENA)) return elapsed

    // 0.4초 뒤 총알 위치를 보고, 제자리를 포함한 아홉 후보 중 가장 안전한 곳으로 한 걸음
    const soon = advance(bullets, 0.4)
    const center = { x: ARENA.width / 2, y: ARENA.height / 2 }
    const half = Math.hypot(ARENA.width, ARENA.height) / 2

    const candidates = [me]
    for (let dir = 0; dir < 8; dir++) {
      const a = (dir / 8) * Math.PI * 2
      candidates.push({
        x: Math.min(ARENA.width, Math.max(0, me.x + Math.cos(a) * moveSpeed * dt)),
        y: Math.min(ARENA.height, Math.max(0, me.y + Math.sin(a) * moveSpeed * dt)),
      })
    }

    let best = me
    let bestScore = -Infinity
    for (const spot of candidates) {
      const nearest = soon.length
        ? Math.min(...soon.map((b) => Math.hypot(b.x - spot.x, b.y - spot.y)))
        : half
      // 총알에서 멀수록 좋고, 벽에 붙을수록 나쁘다.
      // 벽 감점이 없으면 총알이 없을 때 구석으로 걸어가 스스로 갇힌다.
      const openness = -Math.hypot(spot.x - center.x, spot.y - center.y) / half
      const score = Math.min(nearest, half) / half + openness * 0.35
      if (score > bestScore) {
        bestScore = score
        best = spot
      }
    }
    me = best
  }
  return DURATION_MS
}

describe('피할 수 있는가', () => {
  /*
   * 이 봇은 한 걸음 앞만 보는 탐욕 알고리즘이라 사람보다 한참 서툴다.
   * 15초 완주율은 5%밖에 안 되므로 "끝까지 버틸 수 있는가"의 판정에는 쓸 수 없다.
   * "이 정도로 서툴러도 합격선은 넘는가"까지만 대변한다.
   */
  it('직진탄만 놓고 보면 대충 피해도 합격선을 넘는다', () => {
    // 못 피하는 밀도·속도면 난이도 조절이 아니라 그냥 불가능한 게임이다.
    const seeds = Array.from({ length: 12 }, (_, i) => 1 + i * 977)
    for (const seed of seeds) {
      expect(dodgerSurvival(seed)).toBeGreaterThanOrEqual(SURVIVE_TO_PASS_SEC * 1000)
    }
  })
})

describe('가만히 서 있기', () => {
  // 화면 구석·가장자리·한가운데를 촘촘히 훑는다. 격자와 시드가 고정이라 결과도 고정이다.
  const SPOTS = [0, 0.02, 0.1, 0.3, 0.5, 0.7, 0.9, 0.98, 1].flatMap((i) =>
    [0, 0.01, 0.1, 0.3, 0.5, 0.7, 0.9, 0.99, 1].map((j) => ({
      x: ARENA.width * i,
      y: ARENA.height * j,
    })),
  )
  const SEEDS = Array.from({ length: 20 }, (_, i) => 1 + i * 977)

  it('어느 자리에 가만히 서 있어도 제한시간을 채우지 못한다', () => {
    // 예전에는 구석이 영구 안전지대라 박혀 있으면 끝까지 살았다.
    for (const spot of SPOTS) {
      for (const seed of SEEDS) {
        expect(survivalOf(seed, spot)).toBeLessThan(DURATION_MS)
      }
    }
  })

  it('가만히 서 있으면 거의 언제나 합격선 전에 죽는다', () => {
    // 유도탄은 선회 반경이 있어서 정지 표적을 100% 맞히지는 못한다.
    // 버티기가 전략이 되지 않을 만큼만 막으면 된다 — 실측 92.8%에서 여유를 두고 90%로 건다.
    const runs = SPOTS.flatMap((spot) => SEEDS.map((seed) => survivalOf(seed, spot)))
    const died = runs.filter((ms) => ms < SURVIVE_TO_PASS_SEC * 1000).length

    expect(died / runs.length).toBeGreaterThan(0.9)
  })

  it('한가운데도 안전지대가 아니다', () => {
    const center = { x: ARENA.width / 2, y: ARENA.height / 2 }
    for (const seed of SEEDS) {
      expect(survivalOf(seed, center)).toBeLessThan(SURVIVE_TO_PASS_SEC * 1000)
    }
  })
})

describe('steerToward', () => {
  const player = { x: 200, y: 350 }
  const straight: Bullet = { x: 200, y: 300, vx: 0, vy: 100, radius: 5 }
  // 사거리(반지름 × HOMING_RANGE_IN_RADII) 안에 두어야 유도가 걸린다
  const homing: Bullet = { ...straight, x: 120, y: 300, vx: 100, vy: 0, homingMsLeft: 2_000 }

  it('보통 총알은 방향이 변하지 않는다', () => {
    const [after] = steerToward([straight], player, 0.1)
    expect(after.vx).toBeCloseTo(straight.vx)
    expect(after.vy).toBeCloseTo(straight.vy)
  })

  it('유도탄은 플레이어 쪽으로 방향을 튼다', () => {
    const before = Math.atan2(player.y - homing.y, player.x - homing.x)
    const [after] = steerToward([homing], player, 0.1)
    const angleBefore = Math.abs(Math.atan2(homing.vy, homing.vx) - before)
    const angleAfter = Math.abs(Math.atan2(after.vy, after.vx) - before)

    expect(angleAfter).toBeLessThan(angleBefore)
  })

  it('유도탄이 한 번에 확 꺾이지는 않는다 — 돌아서면 따돌릴 수 있어야 한다', () => {
    const dtSec = 0.1
    const [after] = steerToward([homing], player, dtSec)
    const turned = Math.abs(
      Math.atan2(after.vy, after.vx) - Math.atan2(homing.vy, homing.vx),
    )
    expect(turned).toBeLessThanOrEqual(HOMING_TURN_RATE * dtSec + 1e-9)
  })

  it('유도해도 속도는 그대로다', () => {
    const [after] = steerToward([homing], player, 0.1)
    expect(Math.hypot(after.vx, after.vy)).toBeCloseTo(Math.hypot(homing.vx, homing.vy))
  })

  it('사거리 밖에서는 유도하지 않는다 — 멀리서부터 매달리면 따돌릴 수가 없다', () => {
    const far: Bullet = { ...homing, x: homing.radius * HOMING_RANGE_IN_RADII * 3, y: -500 }
    const [after] = steerToward([far], player, 0.1)

    expect(after.vx).toBeCloseTo(far.vx)
    expect(after.vy).toBeCloseTo(far.vy)
    // 사거리 밖에서 시간이 흐르면 정작 붙었을 때 남은 유도가 없다
    expect(after.homingMsLeft).toBe(far.homingMsLeft)
  })

  it('유도 시간이 다하면 직진한다 — 끝까지 쫓아오면 피할 방법이 없다', () => {
    const spent: Bullet = { ...homing, homingMsLeft: 0 }
    const [after] = steerToward([spent], player, 0.1)
    expect(after.vx).toBeCloseTo(spent.vx)
    expect(after.vy).toBeCloseTo(spent.vy)
  })

  it('유도 시간이 줄어든다', () => {
    const [after] = steerToward([homing], player, 0.1)
    expect(after.homingMsLeft).toBeCloseTo(1_900)
  })

  it('원본 배열을 변경하지 않는다', () => {
    const input = [{ ...homing }]
    const snapshot = JSON.stringify(input)
    steerToward(input, player, 0.1)
    expect(JSON.stringify(input)).toBe(snapshot)
  })
})

describe('유도탄 배치', () => {
  it('한 웨이브에 유도탄이 몇 발까지만 섞인다', () => {
    for (const seed of [1, 7, 99, 4242, 31337]) {
      for (const wave of buildWaves(seed, ARENA, DURATION_MS)) {
        const homing = wave.bullets.filter((b) => (b.homingMsLeft ?? 0) > 0)
        expect(homing.length).toBeLessThanOrEqual(HOMING_PER_WAVE_MAX)
      }
    }
  })

  it('시작하자마자 유도탄이 나오지는 않는다 — 첫 판부터 쫓기면 배울 틈이 없다', () => {
    const first = buildWaves(7, ARENA, DURATION_MS)[0]
    expect(first.bullets.every((b) => !b.homingMsLeft)).toBe(true)
  })

  it('한 판에 유도탄이 실제로 나온다', () => {
    expect(allBullets(7).some((b) => (b.homingMsLeft ?? 0) > 0)).toBe(true)
  })
})

describe('closestApproach', () => {
  it('임의의 점에 대해서도 가장 가까워지는 거리를 준다', () => {
    const bullet: Bullet = { x: 0, y: 100, vx: 100, vy: 0, radius: 5 }
    expect(closestApproach(bullet, { x: 300, y: 130 })).toBeCloseTo(30)
  })
})

describe('advance', () => {
  const bullet: Bullet = { x: 100, y: 100, vx: 60, vy: -30, radius: 5 }

  it('속도 × 시간만큼 움직인다', () => {
    const [moved] = advance([bullet], 0.5)

    expect(moved.x).toBeCloseTo(130)
    expect(moved.y).toBeCloseTo(85)
  })

  it('원본 배열을 변경하지 않는다', () => {
    advance([bullet], 1)
    expect(bullet).toEqual({ x: 100, y: 100, vx: 60, vy: -30, radius: 5 })
  })

  it('화면을 완전히 벗어난 총알은 사라진다', () => {
    const leaving: Bullet = { x: 10, y: 10, vx: -1000, vy: -1000, radius: 5 }
    expect(advance([leaving], 1, ARENA)).toEqual([])
  })

  it('아직 화면 밖에서 들어오는 중인 총알은 남는다', () => {
    const entering: Bullet = { x: -ARENA_MARGIN / 2, y: 100, vx: 100, vy: 0, radius: 5 }
    expect(advance([entering], 0.01, ARENA)).toHaveLength(1)
  })
})

describe('isHit', () => {
  const player = { x: 100, y: 100 }
  const hitbox = PLAYER_HITBOX_RATIO * Math.min(ARENA.width, ARENA.height)

  it('총알이 겹치면 맞은 것이다', () => {
    const bullet: Bullet = { x: 100, y: 100, vx: 0, vy: 0, radius: 8 }
    expect(isHit(player, [bullet], ARENA)).toBe(true)
  });

  it('멀리 있으면 맞지 않는다', () => {
    const bullet: Bullet = { x: 300, y: 300, vx: 0, vy: 0, radius: 8 }
    expect(isHit(player, [bullet], ARENA)).toBe(false)
  })

  it('스칠 듯 말 듯한 거리는 맞지 않는다 — 히트박스가 보이는 것보다 작다', () => {
    const grazing: Bullet = { x: 100 + hitbox + 8 + 1, y: 100, vx: 0, vy: 0, radius: 8 }
    expect(isHit(player, [grazing], ARENA)).toBe(false)
  })

  it('총알이 하나도 없으면 맞지 않는다', () => {
    expect(isHit(player, [], ARENA)).toBe(false)
  })

  it('여러 발 중 하나만 맞아도 맞은 것이다', () => {
    const bullets: Bullet[] = [
      { x: 300, y: 300, vx: 0, vy: 0, radius: 8 },
      { x: 100, y: 100, vx: 0, vy: 0, radius: 8 },
    ]
    expect(isHit(player, bullets, ARENA)).toBe(true)
  })
})

describe('computeResult', () => {
  const TIME_LIMIT = TIME_LIMIT_SEC
  const passMs = SURVIVE_TO_PASS_SEC * 1000

  it('제한시간은 20초다', () => {
    expect(TIME_LIMIT_SEC).toBe(20)
  })

  it('제한시간을 늘려도 앞부분 탄막은 그대로다', () => {
    // 난이도를 제한시간 대비 비율로 매기면, 시간을 늘리는 순간 앞부분이 통째로 헐거워져
    // "7초 버티면 합격"의 체감 난이도가 같이 바뀐다. 램프는 절대 경과 시간에 건다.
    const short = buildWaves(7, ARENA, 15_000)
    const long = buildWaves(7, ARENA, 20_000)

    expect(long.slice(0, short.length)).toEqual(short)
  })

  it('7초를 버티면 정확히 기준선이다 — 여기가 합격선이다', () => {
    // 기준선은 앱 전역에서 40점 하나뿐이다. 합격선을 옮기려면 기준선이 아니라 이 식을 고친다.
    expect(computeResult({ survivedMs: passMs, timeLimitSec: TIME_LIMIT }).normalizedScore).toBe(
      PENALTY_THRESHOLD,
    )
  })

  it('7초를 못 채우면 기준선에 못 미친다', () => {
    const result = computeResult({ survivedMs: passMs - 1, timeLimitSec: TIME_LIMIT })
    expect(result.normalizedScore).toBeLessThan(PENALTY_THRESHOLD)
  })

  it('7초를 넘기면 기준선을 넘는다', () => {
    const result = computeResult({ survivedMs: passMs + 1, timeLimitSec: TIME_LIMIT })
    expect(result.normalizedScore).toBeGreaterThan(PENALTY_THRESHOLD)
  })

  it('끝까지 버티면 100점이다', () => {
    expect(
      computeResult({ survivedMs: TIME_LIMIT * 1000, timeLimitSec: TIME_LIMIT }).normalizedScore,
    ).toBe(100)
  })

  it('시작하자마자 맞으면 0점이다', () => {
    expect(computeResult({ survivedMs: 0, timeLimitSec: TIME_LIMIT }).normalizedScore).toBe(0)
  })

  it('합격선까지는 버틴 만큼 고르게 오른다', () => {
    // 합격 못 해도 얼마나 버텼는지가 3판 평균에 그대로 반영돼야 한다.
    expect(computeResult({ survivedMs: passMs / 2, timeLimitSec: TIME_LIMIT }).normalizedScore).toBe(
      PENALTY_THRESHOLD / 2,
    )
  })

  it('오래 버틸수록 점수가 높다', () => {
    const scores = [0, 2_000, 6_000, 9_000, 14_000, 15_000].map(
      (survivedMs) => computeResult({ survivedMs, timeLimitSec: TIME_LIMIT }).normalizedScore,
    )
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThan(scores[i - 1])
    }
  })

  it('제한시간을 넘겨도 100점을 넘지 않는다', () => {
    expect(computeResult({ survivedMs: 99_000, timeLimitSec: TIME_LIMIT }).normalizedScore).toBe(100)
  })

  it('score는 버틴 시간을 소수 첫째 자리까지 담는다 — 화면에 초로 표시한다', () => {
    expect(computeResult({ survivedMs: 12_340, timeLimitSec: TIME_LIMIT }).score).toBe(12.3)
  })

  it('어떤 입력에도 계약을 위반하지 않는다', () => {
    for (const survivedMs of [-1, 0, 1, passMs, TIME_LIMIT * 1000, 99_000]) {
      const result = computeResult({ survivedMs, timeLimitSec: TIME_LIMIT })
      expect(validateGameResult(result, 'bulletHell')).toEqual([])
    }
  })

  it('tiebreakMs는 오래 버틸수록 작다 — 계약이 작을수록 유리로 정한다', () => {
    const early = computeResult({ survivedMs: 3_000, timeLimitSec: TIME_LIMIT })
    const late = computeResult({ survivedMs: 15_000, timeLimitSec: TIME_LIMIT })

    expect(late.tiebreakMs).toBeLessThan(early.tiebreakMs)
    expect(late.tiebreakMs).toBeGreaterThanOrEqual(0)
  })

  it('완주자의 tiebreakMs는 0이다', () => {
    expect(computeResult({ survivedMs: TIME_LIMIT * 1000, timeLimitSec: TIME_LIMIT }).tiebreakMs).toBe(0)
  })

  it('맞아서 죽어도 완주로 친다 — 이탈이 아니라 정상적인 게임 결과다', () => {
    expect(computeResult({ survivedMs: 5_000, timeLimitSec: TIME_LIMIT }).finished).toBe(true)
  })

  it('중도 이탈은 완주가 아니다', () => {
    const result = computeResult({ survivedMs: 5_000, timeLimitSec: TIME_LIMIT, finished: false })
    expect(result.finished).toBe(false)
  })
})
