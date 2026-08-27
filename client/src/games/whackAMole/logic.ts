import { createRng } from '../prng'

/** 3×3 격자. */
export const HOLE_COUNT = 9

/** 그리드 한 줄에 들어가는 구멍 수. 9개를 3x3 으로 놓는다. */
export const HOLE_COLUMNS = 3

/** 구멍 한 변의 길이(px). 화면 스타일과 좌표 판정이 같은 값을 봐야 한다. */
export const HOLE_SIZE = 100

/** 구멍 사이 여백(px) */
export const HOLE_GAP = 10

/**
 * 그리드 기준 좌표가 어느 구멍인지. 구멍 밖(사이 여백)이면 null.
 *
 * 구멍마다 Pressable 을 두지 않고 그리드 전체를 터치면 하나로 받는 이유:
 * React Native 의 응답자(responder)는 전역에 하나뿐이라, 서로 다른 Pressable
 * 두 개를 동시에 누르면 두 번째 손가락이 통째로 버려진다. 두더지는 한 번에
 * 두 마리까지 올라오므로 그러면 동시에 잡을 수가 없다. 응답자 하나가
 * 모든 손가락을 받게 하고 좌표로 구멍을 찾는다.
 *
 * 판정은 원이 아니라 정사각형이다 — 화면에서는 둥글게 보이지만 예전
 * Pressable 도 사각 영역 전체가 눌렸다. 모서리를 빼면 더 어려워진다.
 */
export function holeAt(x: number, y: number): number | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null

  const step = HOLE_SIZE + HOLE_GAP
  const col = Math.floor(x / step)
  const row = Math.floor(y / step)
  if (x < 0 || y < 0 || col >= HOLE_COLUMNS) return null

  // 구멍 사이 여백에 떨어진 터치는 아무 것도 아니다
  if (x - col * step > HOLE_SIZE) return null
  if (y - row * step > HOLE_SIZE) return null

  const hole = row * HOLE_COLUMNS + col
  return hole < HOLE_COUNT ? hole : null
}

/**
 * 제한시간(초). 이 게임은 항상 이 길이로 돈다.
 *
 * 스케줄이 "웨이브 간격 × 웨이브 수"로 짜이므로 길이가 바뀌면 등장 리듬이
 * 통째로 달라진다. 고정해 두고 편성(info.timeLimitSec)도 같은 값을 쓴다.
 */
export const TIME_LIMIT_SEC = 20

/**
 * 한 웨이브에 같이 나오는 개수의 범위.
 *
 * 매번 한 마리씩이면 순서대로 치기만 하면 돼서 시시하다. 둘이 같이 나오면
 * 어느 쪽을 먼저 칠지 골라야 하고, 그중 하나가 폭탄이면 손이 멈춘다.
 */
export const MIN_PER_WAVE = 1
export const MAX_PER_WAVE = 2

/**
 * 웨이브 간격(ms).
 *
 * 제한시간을 이 값으로 나눈 만큼 웨이브가 생긴다. 한 웨이브에 1~2개가
 * 랜덤으로 나오므로 한 판의 총 등장 수는 시드마다 다르다 — 그래서 점수는
 * 고정 마릿수가 아니라 실제로 나온 두더지 수로 나눈다(normalize).
 */
export const WAVE_INTERVAL_MS = 1000

/**
 * 치면 안 되는 폭탄의 비중.
 *
 * 개수로 고정하면 판이 커질수록 폭탄이 묽어져 난이도가 떨어진다.
 * 등장물 20개에 5개이던 시절과 같은 비율이라, 총량이 늘어도 밀도가 같다.
 */
export const BOMB_RATIO = 0.25

/**
 * 등장물 total개짜리 판에 섞을 폭탄 수.
 *
 * 내림으로 자른다. 반올림하면 두더지가 한 마리도 없는 판이 나올 수 있고,
 * 그러면 무엇을 해도 0점이라 게임이 성립하지 않는다.
 */
export function bombCountFor(total: number): number {
  return Math.min(Math.floor(total * BOMB_RATIO), Math.max(0, total - 1))
}

/**
 * 표시 시간 범위(ms).
 *
 * 후반으로 갈수록 짧아지는 방식이었는데, 이제는 매번 이 사이에서 뽑는다.
 * 언제 짧은 놈이 나올지 모르니 판 내내 긴장이 유지된다.
 */
export const VISIBLE_MIN_MS = 500
export const VISIBLE_MAX_MS = 1000

/**
 * 통과선. 나온 두더지의 이 비율을 잡으면 기준선(PENALTY_THRESHOLD)에 닿는다.
 *
 * 총 등장 수가 시드마다 달라도 "나온 것 중 40%"라는 기준은 그대로다.
 * 운 나쁘게 적게 나온 판이라고 불리해지지 않는다.
 */
export const PASS_RATIO = 0.4

/** 폭탄 하나를 쳤을 때 깎는 점수. */
export const BOMB_PENALTY = 1

/** 등장 시각을 균등 간격에서 흔드는 폭. 규칙적이면 리듬만 타면 돼서 시시하다. */
const JITTER_MS = 150

export type SpawnKind = 'mole' | 'bomb'

export interface Spawn {
  kind: SpawnKind
  /** 0 ~ HOLE_COUNT-1 */
  hole: number
  showAtMs: number
  hideAtMs: number
}

/**
 * 시드에서 등장 스케줄 전체를 미리 만든다.
 *
 * 매 프레임 난수를 뽑지 않고 시작 시점에 전부 확정한다.
 * 프레임 수가 폰마다 달라도 같은 것이 같은 때 나와야 공정하기 때문이다.
 */
export function buildSpawns(seed: number, durationMs: number): Spawn[] {
  const rng = createRng(seed)
  const holes = Array.from({ length: HOLE_COUNT }, (_, h) => h)
  const waveCount = Math.max(1, Math.floor(durationMs / WAVE_INTERVAL_MS))

  // 웨이브마다 몇 개가 같이 나올지 먼저 정한다. 이 합이 한 판의 총 등장 수다.
  const sizes = Array.from({ length: waveCount }, () => rng.int(MIN_PER_WAVE, MAX_PER_WAVE))
  const total = sizes.reduce((n, s) => n + s, 0)

  // 어느 순번이 폭탄인지 정한다. 시드가 같으면 폭탄 위치도 같다.
  const order = rng.shuffle(Array.from({ length: total }, (_, i) => i))
  const bombTurns = new Set(order.slice(0, bombCountFor(total)))

  /** 구멍별로 마지막 등장물이 사라지는 시각. 같은 구멍이 겹치는 것을 막는다. */
  const freeAt = new Array<number>(HOLE_COUNT).fill(0)

  const spawns: Spawn[] = []
  let turn = 0

  for (let w = 0; w < waveCount; w++) {
    // 표시 시간을 먼저 뽑는다. 웨이브가 통째로 제한시간 안에 들어가려면
    // 그중 가장 긴 것을 기준으로 등장 시각을 당겨야 하기 때문이다.
    const visibles = Array.from({ length: sizes[w] }, () => rng.int(VISIBLE_MIN_MS, VISIBLE_MAX_MS))
    const longest = Math.max(...visibles)

    const base = w * WAVE_INTERVAL_MS + rng.int(-JITTER_MS, JITTER_MS)
    // "한 번에" 나오려면 이 웨이브의 등장 시각이 하나여야 한다.
    const showAtMs = Math.round(Math.min(Math.max(base, 0), durationMs - longest))

    /** 이번 웨이브가 이미 쓴 구멍. 동시에 나오므로 서로 달라야 한다. */
    const taken = new Set<number>()

    for (let k = 0; k < sizes[w]; k++, turn++) {
      // 그 시각에 비어 있고 이번 웨이브에 아직 안 쓴 구멍만 후보로 둔다.
      const free = holes.filter((h) => !taken.has(h) && freeAt[h] <= showAtMs)
      // 전부 차 있으면 남은 것 중 가장 먼저 비는 구멍을 쓴다.
      // 구멍 9개에 한 웨이브 최대 2개라 실제로는 거의 일어나지 않는다.
      const rest = holes.filter((h) => !taken.has(h))
      const hole =
        free.length > 0
          ? free[rng.int(0, free.length - 1)]
          : rest.reduce((best, h) => (freeAt[h] < freeAt[best] ? h : best), rest[0])

      taken.add(hole)
      const start = Math.max(showAtMs, freeAt[hole])
      const hideAtMs = Math.min(start + visibles[k], durationMs)

      freeAt[hole] = hideAtMs
      spawns.push({
        kind: bombTurns.has(turn) ? 'bomb' : 'mole',
        hole,
        showAtMs: start,
        hideAtMs,
      })
    }
  }

  return spawns.sort((a, b) => a.showAtMs - b.showAtMs)
}

/** 이 스케줄에 실제로 나오는 두더지 수. 정규화의 분모다. */
export function countMoles(spawns: readonly Spawn[]): number {
  return spawns.reduce((n, s) => n + (s.kind === 'mole' ? 1 : 0), 0)
}

/**
 * 폭탄 감점을 반영한 최종 점수.
 *
 * 감점을 2로 하면 폭탄을 몇 개 쳤을 때 기준선만큼이 통째로 날아가
 * 만회가 불가능해진다. 1이면 두더지를 더 잡아 메꿀 수 있다.
 */
export function netScore(moleHits: number, bombHits: number): number {
  return Math.max(0, moleHits - bombHits * BOMB_PENALTY)
}

/**
 * 점수를 0~100으로 정규화한다.
 *
 * 분모가 실제로 나온 두더지 수라서 나온 것의 40%를 잡으면 정확히 기준선
 * 40점이 된다 — 총량이 시드마다 달라도 통과 조건은 같은 비율이다.
 *
 * 빈 구멍 헛스윙은 감점하지 않는다. 두더지를 놓치는 것 자체가 이미
 * 페널티이고, 헛스윙까지 깎으면 취한 사람에게 이중 처벌이 된다.
 * 폭탄은 다르다 — 치지 말아야 할 것을 친 것이므로 감점한다.
 */
export function normalize(score: number, moleCount: number): number {
  if (moleCount <= 0) return 0
  const ratio = (score / moleCount) * 100
  return Math.min(100, Math.max(0, ratio))
}
