import { createRng } from '../prng'
import { PENALTY_THRESHOLD } from '../types'
import type { GameResult } from '../types'

/** 한 판의 제한시간(초). 모듈 정보와 정규화 식이 같은 값을 본다. */
export const TIME_LIMIT_SEC = 20

/**
 * 난이도가 최대까지 오르는 데 걸리는 시간(초).
 *
 * 제한시간 대비 비율로 매기면 제한시간을 늘리는 순간 앞부분이 통째로 헐거워져
 * "7초 버티면 합격"의 체감 난이도가 같이 흔들린다. 절대 경과 시간에 건다.
 * 제한시간이 이보다 길면 남은 시간은 최고 난이도로 이어진다.
 */
export const RAMP_FULL_SEC = 15

/**
 * 합격선이 되는 생존 시간(초).
 *
 * 이만큼 버티면 정확히 PENALTY_THRESHOLD가 나온다.
 * 기준선은 앱 전역에서 40점 하나뿐이므로, 합격선을 옮길 때는
 * 기준선이 아니라 computeResult의 식을 고친다(개발가이드 규칙 2).
 */
export const SURVIVE_TO_PASS_SEC = 7

/** 화면 크기. 로직은 전부 이 픽셀 좌표계 안에서 계산한다. */
export interface Arena {
  width: number
  height: number
}

export interface Bullet {
  x: number
  y: number
  /** 초당 이동 거리(px) */
  vx: number
  vy: number
  radius: number
  /**
   * 남은 유도 시간(ms). 없거나 0이면 평범한 직진탄이다.
   *
   * 0보다 큰 동안만 플레이어 쪽으로 방향을 튼다. 끝까지 쫓아오면
   * 피할 방법 자체가 없어지므로 반드시 수명을 준다.
   */
  homingMsLeft?: number
}

/** 한 시점에 한꺼번에 등장하는 총알 묶음. */
export interface Wave {
  /** 게임 시작으로부터 몇 ms 뒤에 등장하는가 */
  atMs: number
  bullets: Bullet[]
}

/**
 * 총알이 화면 밖에서 출발할 때 쓰는 여유 거리.
 *
 * 화면 안에서 튀어나오면 피할 수가 없다. 항상 이 여백만큼 밖에서 시작해 들어온다.
 */
export const ARENA_MARGIN = 40

/** 플레이어 히트박스. 짧은 변에 대한 비율이다. */
export const PLAYER_HITBOX_RATIO = 0.016

/** 화면에 그려지는 플레이어 크기. 히트박스보다 크다 — 아슬아슬하게 피하는 맛이 여기서 나온다. */
export const PLAYER_VISUAL_RATIO = 0.030

/** 총알 크기. 짧은 변에 대한 비율이다. */
const BULLET_RADIUS_RATIO = 0.018

/** 총알 속도. 화면 대각선에 대한 초당 비율. 시간이 갈수록 SPEED_RAMP만큼 빨라진다. */
const SPEED_BASE = 0.16
const SPEED_RAMP = 0.11

/** 웨이브 간격. 시작은 느슨하고 끝으로 갈수록 조여진다. */
const INTERVAL_START_MS = 1000
const INTERVAL_END_MS = 470

/** 한 웨이브의 최대 탄 수. 넘어가면 화면이 꽉 차서 피할 곳이 없어진다. */
export const MAX_BULLETS_PER_WAVE = 12

/**
 * 화면 한가운데에 남겨두는 여유. 짧은 변에 대한 비율이다.
 *
 * 이 안쪽을 스치는 총알이 CENTER_CROWD_LIMIT마리를 넘지 않게 막는다.
 */
export const CENTER_CLEARANCE_RATIO = 0.10

/**
 * 한 웨이브에서 화면 한가운데를 스쳐도 되는 총알 수.
 *
 * 조준점이 판마다 옮겨 다니므로 가끔은 웨이브가 한가운데를 겨냥한다. 그건 정상이다.
 * 막으려는 건 예전처럼 **모든 웨이브가 늘 한 점으로 수렴하던** 상태다.
 *
 * 시드 20개 실측 최대가 7(웨이브 최대 탄수 10)이라 여유를 한 발 두고 8로 건다.
 * 느슨한 상한이며, 실제 난이도 보증은 '가만히 서 있기' 시뮬레이션이 맡는다.
 */
export const CENTER_CROWD_LIMIT = 8

/**
 * 유도탄이 도는 속도(rad/s).
 *
 * 반 바퀴 도는 데 2초쯤 걸린다. 몸을 틀어 반대로 달리면 따돌릴 수 있어야 한다 —
 * 즉시 따라붙으면 피하는 게임이 아니라 죽는 순간을 기다리는 게임이 된다.
 */
export const HOMING_TURN_RATE = 1.5

/**
 * 유도가 지속되는 시간(ms). 이후에는 직진해서 화면 밖으로 빠진다.
 *
 * 짧게 잡는다. 길게 두면 미사일이 플레이어 주위를 계속 맴돌아서
 * 몇 발만 쌓여도 피할 수 없는 그물이 된다. 한 번 휘어 들어와 스쳐 지나가는 정도가 맞다.
 * 이 시간은 사거리 안에 들어온 뒤부터 센다.
 */
export const HOMING_DURATION_MS = 1800

/**
 * 유도가 걸리는 사거리. 총알 반지름의 배수라 화면 크기에 자동으로 비례한다.
 *
 * 멀리서부터 쫓아오면 화면을 가로지르는 내내 매달려서 따돌릴 수가 없다.
 * 가까이 와서야 휘어 들어오게 두면 그때 한 번 비키면 된다.
 */
export const HOMING_RANGE_IN_RADII = 46

/** 한 웨이브에 섞이는 유도탄 수의 상한. */
export const HOMING_PER_WAVE_MAX = 2

/**
 * 유도탄이 등장하기 시작하는 지점(진행률).
 *
 * 첫 웨이브부터 쫓기면 조작을 익힐 틈이 없다.
 */
export const HOMING_STARTS_AT = 0.05

/**
 * 시드에서 탄막 전체를 미리 만든다.
 *
 * 매 프레임 난수를 뽑지 않고 시작 시점에 전부 확정한다.
 * 프레임 수가 폰마다 달라도 탄막이 똑같아야 공정하기 때문이다.
 */
export function buildWaves(seed: number, arena: Arena, durationMs: number): Wave[] {
  const rng = createRng(seed)
  const waves: Wave[] = []

  let atMs = 300
  let waveIndex = 0

  while (atMs < durationMs) {
    const progress = Math.min(1, atMs / (RAMP_FULL_SEC * 1000))
    waves.push({
      atMs,
      bullets: makeWave(rng, arena, waveIndex, progress),
    })

    atMs += Math.round(INTERVAL_START_MS + (INTERVAL_END_MS - INTERVAL_START_MS) * progress)
    waveIndex += 1
  }

  return waves
}

/**
 * 패턴 세 가지를 순서대로 돌린다.
 *
 * 조준탄(플레이어를 향해 쏘는 탄)은 넣지 않는다. 플레이어 위치는 폰마다 다르므로
 * 조준탄을 쓰는 순간 사람마다 다른 탄막이 되어 시드로 맞춘 공정성이 사라진다.
 */
function makeWave(
  rng: ReturnType<typeof createRng>,
  arena: Arena,
  waveIndex: number,
  progress: number,
): Bullet[] {
  // 웨이브마다 조준점을 화면 전체에서 새로 뽑는다.
  // 늘 한가운데를 겨냥하면 구석이 영구 안전지대가 되어 박혀 있는 게 최적 전략이 된다.
  const anchor = waveAnchor(rng, arena)

  const bullets =
    waveIndex % 3 === 0
      ? scatterPattern(rng, arena, anchor, progress)
      : waveIndex % 3 === 1
        ? ringPattern(rng, arena, anchor, progress)
        : sweepPattern(rng, arena, anchor, progress)

  return withHoming(rng, bullets, progress)
}

/**
 * 이번 웨이브가 겨냥할 지점.
 *
 * 가장자리에서 조금 안쪽까지 포함해 화면 어디든 나온다.
 * 완전히 모서리 밖까지 허용하면 탄이 화면을 스치기만 하고 지나간다.
 */
function waveAnchor(rng: ReturnType<typeof createRng>, arena: Arena): { x: number; y: number } {
  const inset = 0.08
  return {
    x: arena.width * (inset + rng.next() * (1 - inset * 2)),
    y: arena.height * (inset + rng.next() * (1 - inset * 2)),
  }
}

/**
 * 웨이브의 일부를 유도탄으로 바꾼다.
 *
 * 출발 위치와 시각은 그대로 두고 유도 수명만 붙인다 —
 * 그래야 모든 폰이 같은 자리에서 같은 시각에 같은 수의 탄을 본다.
 */
function withHoming(
  rng: ReturnType<typeof createRng>,
  bullets: Bullet[],
  progress: number,
): Bullet[] {
  if (progress < HOMING_STARTS_AT) return bullets

  const count = Math.min(
    HOMING_PER_WAVE_MAX,
    bullets.length,
    1 + Math.round((progress - HOMING_STARTS_AT) * 2),
  )
  const picked = new Set(
    rng.shuffle(bullets.map((_, i) => i)).slice(0, count),
  )

  return bullets.map((b, i) =>
    picked.has(i) ? { ...b, homingMsLeft: HOMING_DURATION_MS } : b,
  )
}

/** 가장자리 아무 데서나 제각각 다른 길로. 가장 예측하기 어렵다. */
function scatterPattern(
  rng: ReturnType<typeof createRng>,
  arena: Arena,
  anchor: { x: number; y: number },
  progress: number,
): Bullet[] {
  const count = clampCount(2 + Math.round(progress * 3))
  const speed = speedAt(arena, progress)
  const spread = laneSpread(arena, count)
  const aim = fitAnchor(anchor, arena, spread, count)

  return Array.from({ length: count }, (_, i) => {
    const spawn = spawnPoint(arena, rng.next() * Math.PI * 2)
    return aimFrom(arena, spawn, perpLaneTarget(spawn, aim, laneOffset(i, count, spread)), speed)
  })
}

/** 화면을 빙 둘러싼 고리가 한꺼번에 좁혀 들어온다. 사방팔방이 가장 잘 드러나는 패턴이다. */
function ringPattern(
  rng: ReturnType<typeof createRng>,
  arena: Arena,
  anchor: { x: number; y: number },
  progress: number,
): Bullet[] {
  const count = clampCount(5 + Math.round(progress * 5))
  const offset = rng.next() * Math.PI * 2
  const speed = speedAt(arena, progress)
  const spread = laneSpread(arena, count)
  const aim = fitAnchor(anchor, arena, spread, count)

  // 예전에는 전원이 같은 점을 겨냥해서 고리가 한 점으로 닫혔다. 지금은 각자 다른 길로 지나간다.
  return Array.from({ length: count }, (_, i) => {
    const spawn = spawnPoint(arena, offset + (i / count) * Math.PI * 2)
    return aimFrom(arena, spawn, perpLaneTarget(spawn, aim, laneOffset(i, count, spread)), speed)
  })
}

/** 가장자리를 훑으며 연속으로 발사한다. 회전하는 빗자루처럼 밀려온다. */
function sweepPattern(
  rng: ReturnType<typeof createRng>,
  arena: Arena,
  anchor: { x: number; y: number },
  progress: number,
): Bullet[] {
  const count = clampCount(3 + Math.round(progress * 4))
  const start = rng.next() * Math.PI * 2
  const direction = rng.next() < 0.5 ? 1 : -1
  const arc = Math.PI * 0.9
  const speed = speedAt(arena, progress)
  const spread = laneSpread(arena, count)
  const aim = fitAnchor(anchor, arena, spread, count)

  /*
   * 훑기는 좁은 부채꼴에서 연달아 쏘기 때문에, 탄마다 수직으로 밀면
   * 밀리는 방향이 조금씩 돌아가면서 결국 한 점에서 모두 교차한다.
   * 웨이브 하나가 축 하나를 잡고 그 축을 따라 나란히 겨냥해야 빗자루처럼 훑고 지나간다.
   */
  const axisAngle = start + direction * (arc / 2) + Math.PI / 2
  const axis = { x: Math.cos(axisAngle), y: Math.sin(axisAngle) }

  return Array.from({ length: count }, (_, i) => {
    const spawn = spawnPoint(arena, start + direction * (i / count) * arc)
    const lane = laneOffset(i, count, spread)
    return aimFrom(arena, spawn, { x: aim.x + axis.x * lane, y: aim.y + axis.y * lane }, speed)
  })
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function clampCount(count: number): number {
  return Math.min(MAX_BULLETS_PER_WAVE, Math.max(1, count))
}

function speedAt(arena: Arena, progress: number): number {
  const diagonal = Math.hypot(arena.width, arena.height)
  return diagonal * (SPEED_BASE + SPEED_RAMP * progress)
}

/**
 * 한 웨이브의 탄들이 벌어지는 폭.
 *
 * 탄이 많을수록 좁게 벌려야 전부 화면 안을 지난다.
 * 화면 밖으로 새면 그 탄은 없는 것과 같아서 패턴이 성기게 느껴진다.
 */
function laneSpread(arena: Arena, count: number): number {
  const short = Math.min(arena.width, arena.height)
  return (short * FAN_WIDTH_RATIO) / Math.max(1, count)
}

/**
 * 한 웨이브가 벌어지는 전체 폭. 짧은 변에 대한 비율이다.
 *
 * 화면 전체를 덮을 만큼 넓히면 부채꼴이 항상 한가운데에 앉아야 해서
 * 조준점을 구석으로 옮길 수가 없다. 절반쯤으로 좁혀야 구석도 겨냥한다.
 */
const FAN_WIDTH_RATIO = 0.5

/**
 * 부채꼴이 화면 밖으로 새지 않도록 조준점을 안쪽으로 당긴다.
 *
 * 겨냥점을 하나씩 잘라내면 여러 발이 같은 자리로 눌려서 틈 없는 벽이 된다.
 * 부채꼴 전체를 통째로 옮겨야 탄 사이 간격이 보존된다.
 */
function fitAnchor(
  anchor: { x: number; y: number },
  arena: Arena,
  spread: number,
  count: number,
): { x: number; y: number } {
  const half = (spread * (count - 1)) / 2
  const fit = (value: number, size: number) =>
    half * 2 >= size ? size / 2 : clamp(value, half, size - half)

  return { x: fit(anchor.x, arena.width), y: fit(anchor.y, arena.height) }
}

/**
 * i번째 탄이 중심에서 얼마나 비켜 지나갈지.
 *
 * 0을 중심으로 좌우로 번갈아 벌어진다. 홀수 번째만 정중앙을 지나므로
 * 한 웨이브가 통째로 한 점에 몰리는 일이 없다.
 */
function laneOffset(index: number, count: number, spread: number): number {
  return (index - (count - 1) / 2) * spread
}

/**
 * 총알이 지금 진행 방향 그대로 갈 때 화면 중심에 가장 가까워지는 거리.
 *
 * 이미 중심을 지나쳐 멀어지는 중이면 지금 거리를 그대로 쓴다 —
 * 지나간 총알을 "중앙을 스친다"고 세면 함정 판정이 틀어진다.
 */
export function closestApproach(bullet: Bullet, point: { x: number; y: number }): number {
  const speed = Math.hypot(bullet.vx, bullet.vy)
  const toX = point.x - bullet.x
  const toY = point.y - bullet.y
  if (speed === 0) return Math.hypot(toX, toY)

  const ux = bullet.vx / speed
  const uy = bullet.vy / speed

  // 진행 방향으로 얼마나 가야 가장 가까워지는가. 음수면 이미 지나쳤다.
  const along = toX * ux + toY * uy
  if (along <= 0) return Math.hypot(toX, toY)

  return Math.abs(toX * uy - toY * ux)
}

/** closestApproach를 화면 한가운데에 대해 잰 값. */
export function closestApproachToCenter(bullet: Bullet, arena: Arena): number {
  return closestApproach(bullet, { x: arena.width / 2, y: arena.height / 2 })
}

/**
 * 유도탄의 방향을 플레이어 쪽으로 조금 튼다.
 *
 * 한 프레임에 HOMING_TURN_RATE × dt 라디안까지만 꺾는다. 즉시 따라붙으면
 * 피하는 게임이 아니라 죽는 순간을 기다리는 게임이 된다.
 *
 * 속도는 건드리지 않는다 — 방향만 바뀌므로 "빨라져서 못 피했다"는 느낌이 나지 않는다.
 *
 * 이 함수만 플레이어 위치를 본다. 출발 위치·시각·개수는 여전히 시드가 정하므로
 * 모든 폰이 같은 탄을 같은 자리에서 받고, 이후 궤적만 각자의 조작에 따라 갈린다.
 */
export function steerToward(
  bullets: readonly Bullet[],
  player: { x: number; y: number },
  dtSec: number,
): Bullet[] {
  return bullets.map((b) => {
    const left = b.homingMsLeft ?? 0
    if (left <= 0) return b

    const speed = Math.hypot(b.vx, b.vy)
    if (speed === 0) return { ...b, homingMsLeft: Math.max(0, left - dtSec * 1000) }

    // 사거리 밖에서는 유도도 안 걸리고 시간도 줄지 않는다.
    const distance = Math.hypot(player.x - b.x, player.y - b.y)
    if (distance > b.radius * HOMING_RANGE_IN_RADII) return b

    const current = Math.atan2(b.vy, b.vx)
    const wanted = Math.atan2(player.y - b.y, player.x - b.x)

    // -π~π로 접어야 먼 쪽으로 빙 돌지 않는다
    let delta = wanted - current
    while (delta > Math.PI) delta -= Math.PI * 2
    while (delta < -Math.PI) delta += Math.PI * 2

    const maxTurn = HOMING_TURN_RATE * dtSec
    const turned = current + Math.max(-maxTurn, Math.min(maxTurn, delta))

    return {
      ...b,
      vx: Math.cos(turned) * speed,
      vy: Math.sin(turned) * speed,
      homingMsLeft: Math.max(0, left - dtSec * 1000),
    }
  })
}

/**
 * 화면을 감싼 사각 테두리 위의 한 점에서 출발해, 중심을 offset만큼 비켜
 * 화면을 가로질러 지나가는 총알을 만든다.
 *
 * 타원으로 잡으면 대각선 방향의 점이 화면 안쪽에 들어와 눈앞에서 총알이 튀어나온다.
 * 중심에서 angle 방향으로 쏜 반직선이 확장된 사각형과 만나는 지점을 쓴다.
 *
 * 예전에는 안쪽 한 점을 겨냥했다. 그러면 웨이브가 그 점으로 수렴해 거기 있는 사람은
 * 사방에서 동시에 맞는다. 비켜 지나가게 두면 탄과 탄 사이로 빠져나갈 틈이 생긴다.
 */
function spawnPoint(arena: Arena, angle: number): { x: number; y: number } {
  const cx = arena.width / 2
  const cy = arena.height / 2
  const halfW = cx + ARENA_MARGIN
  const halfH = cy + ARENA_MARGIN

  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const EPSILON = 1e-9
  const reach = Math.min(
    halfW / Math.max(Math.abs(cos), EPSILON),
    halfH / Math.max(Math.abs(sin), EPSILON),
  )

  return { x: cx + cos * reach, y: cy + sin * reach }
}

/**
 * 출발점에서 조준점으로 향하는 방향에 수직으로 offset만큼 밀어낸 지점.
 *
 * 탄마다 들어오는 방향이 다르면 밀리는 방향도 달라져서 조준점을 둘러싼 꽃잎 모양이 된다.
 */
function perpLaneTarget(
  spawn: { x: number; y: number },
  anchor: { x: number; y: number },
  offset: number,
): { x: number; y: number } {
  const len = Math.hypot(anchor.x - spawn.x, anchor.y - spawn.y) || 1
  const inX = (anchor.x - spawn.x) / len
  const inY = (anchor.y - spawn.y) / len
  return { x: anchor.x - inY * offset, y: anchor.y + inX * offset }
}

function aimFrom(
  arena: Arena,
  spawn: { x: number; y: number },
  target: { x: number; y: number },
  speed: number,
): Bullet {
  const dx = target.x - spawn.x
  const dy = target.y - spawn.y
  const distance = Math.hypot(dx, dy) || 1

  return {
    x: spawn.x,
    y: spawn.y,
    vx: (dx / distance) * speed,
    vy: (dy / distance) * speed,
    radius: BULLET_RADIUS_RATIO * Math.min(arena.width, arena.height),
  }
}

/**
 * 총알을 dtSec만큼 전진시키고, 화면을 완전히 벗어난 것은 버린다.
 *
 * arena를 주지 않으면 이동만 하고 버리지 않는다.
 */
export function advance(bullets: readonly Bullet[], dtSec: number, arena?: Arena): Bullet[] {
  const moved = bullets.map((b) => ({
    ...b,
    x: b.x + b.vx * dtSec,
    y: b.y + b.vy * dtSec,
  }))

  if (!arena) return moved

  const limit = ARENA_MARGIN * 2
  return moved.filter((b) => {
    // 유도 중인 탄은 크게 돌아 들어오느라 잠깐 화면 밖으로 벗어난다.
    // 여기서 지워버리면 구석에 붙어 있는 사람에게는 영영 닿지 못한다.
    if ((b.homingMsLeft ?? 0) > 0) return true
    return b.x > -limit && b.x < arena.width + limit && b.y > -limit && b.y < arena.height + limit
  })
}

/**
 * 플레이어가 총알에 맞았는지.
 *
 * 히트박스가 보이는 것보다 작다(탄막게임 관례). 아슬아슬하게 피하는 맛이 여기서 나온다.
 */
export function isHit(
  player: { x: number; y: number },
  bullets: readonly Bullet[],
  arena: Arena,
): boolean {
  const hitbox = PLAYER_HITBOX_RATIO * Math.min(arena.width, arena.height)
  return bullets.some((b) => Math.hypot(b.x - player.x, b.y - player.y) < b.radius + hitbox)
}

export interface ComputeResultInput {
  survivedMs: number
  timeLimitSec: number
  /** 중도 이탈(언마운트)이면 false. 맞아 죽은 건 정상 결과이므로 기본값 true. */
  finished?: boolean
}

/**
 * 시간형 정규화 (설계 §3.5) — 0~100으로 clamp.
 *
 * 단순 비례가 아니라 합격선에서 꺾이는 두 토막이다.
 * 앞 토막은 0초→0점, SURVIVE_TO_PASS_SEC초→기준선(40점).
 * 뒤 토막은 거기서 제한시간→100점.
 *
 * 이렇게 해야 "7초 버티면 성공"이 기준선과 정확히 맞물린다.
 * 못 버텨도 버틴 만큼 고르게 점수가 남아서 3판 평균이 억울해지지 않는다.
 */
export function computeResult({
  survivedMs,
  timeLimitSec,
  finished = true,
}: ComputeResultInput): GameResult {
  const limitMs = timeLimitSec * 1000
  const survived = Math.min(limitMs, Math.max(0, survivedMs))

  // 제한시간이 합격선보다 짧게 들어오면 꺾을 곳이 없다. 그때는 단순 비례로 떨어뜨린다.
  const passMs = Math.min(SURVIVE_TO_PASS_SEC * 1000, limitMs)

  const normalizedScore =
    survived <= passMs
      ? (survived / passMs) * PENALTY_THRESHOLD
      : PENALTY_THRESHOLD +
        ((survived - passMs) / (limitMs - passMs)) * (100 - PENALTY_THRESHOLD)

  return {
    normalizedScore,
    // 화면에는 "12.3초"로 보여준다
    score: Math.round(survived / 100) / 10,
    // 계약이 "작을수록 유리"로 정했으므로 남은 시간을 넣는다. 완주자는 0이다.
    tiebreakMs: limitMs - survived,
    finished,
  }
}
