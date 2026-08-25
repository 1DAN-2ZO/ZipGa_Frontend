import { createRng } from '../prng'

/** 3×3 격자. */
export const HOLE_COUNT = 9

/** 잡아야 하는 두더지 수. 정규화의 분모가 된다. */
export const MOLE_COUNT = 15

/** 치면 안 되는 폭탄 수. */
export const BOMB_COUNT = 5

/**
 * 한 판에 등장하는 총 개수.
 *
 * 등장 간격은 제한시간 / 이 값이다. 20초에 20개면 1000ms.
 * 제한시간을 늘릴 때 이 값을 같이 늘려야 간격이 유지된다.
 * 그러지 않으면 등장이 뜸해져 게임이 늘어진다.
 */
export const SPAWN_COUNT = MOLE_COUNT + BOMB_COUNT

/** 폭탄 하나를 쳤을 때 깎는 점수. */
export const BOMB_PENALTY = 1

/** 표시 시간. 후반으로 갈수록 END에 가까워져 난이도가 오른다. */
const VISIBLE_START_MS = 1050
const VISIBLE_END_MS = 650

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

  // 어느 순번이 폭탄인지 먼저 정한다. 시드가 같으면 폭탄 위치도 같다.
  const order = rng.shuffle(Array.from({ length: SPAWN_COUNT }, (_, i) => i))
  const bombTurns = new Set(order.slice(0, BOMB_COUNT))

  /** 구멍별로 마지막 등장물이 들어간 시각. 같은 구멍이 겹치는 것을 막는다. */
  const freeAt = new Array<number>(HOLE_COUNT).fill(0)

  const gap = durationMs / SPAWN_COUNT
  const spawns: Spawn[] = []

  for (let i = 0; i < SPAWN_COUNT; i++) {
    const progress = i / Math.max(1, SPAWN_COUNT - 1)
    const visibleMs = Math.round(
      VISIBLE_START_MS + (VISIBLE_END_MS - VISIBLE_START_MS) * progress,
    )

    const base = i * gap + rng.int(-JITTER_MS, JITTER_MS)
    // 마지막 등장물까지 제한시간 안에 들어가야 한다.
    const showAtMs = Math.round(Math.min(Math.max(base, 0), durationMs - visibleMs))

    // 그 시각에 비어 있는 구멍만 후보로 둔다.
    const free: number[] = []
    for (let h = 0; h < HOLE_COUNT; h++) {
      if (freeAt[h] <= showAtMs) free.push(h)
    }
    // 전부 차 있으면 가장 먼저 비는 구멍을 쓴다. 실제로는 거의 일어나지 않는다.
    const hole =
      free.length > 0
        ? free[rng.int(0, free.length - 1)]
        : freeAt.indexOf(Math.min(...freeAt))

    const start = Math.max(showAtMs, freeAt[hole])
    const hideAtMs = Math.min(start + visibleMs, durationMs)

    freeAt[hole] = hideAtMs
    spawns.push({
      kind: bombTurns.has(i) ? 'bomb' : 'mole',
      hole,
      showAtMs: start,
      hideAtMs,
    })
  }

  return spawns.sort((a, b) => a.showAtMs - b.showAtMs)
}

/**
 * 폭탄 감점을 반영한 최종 점수.
 *
 * 감점을 2로 하면 폭탄 셋을 다 쳤을 때 기준선만큼이 통째로 날아가
 * 만회가 불가능해진다. 1이면 두더지 하나를 더 잡아 메꿀 수 있다.
 */
export function netScore(moleHits: number, bombHits: number): number {
  return Math.max(0, moleHits - bombHits * BOMB_PENALTY)
}

/**
 * 점수를 0~100으로 정규화한다.
 *
 * 빈 구멍 헛스윙은 감점하지 않는다. 두더지를 놓치는 것 자체가 이미
 * 페널티이고, 헛스윙까지 깎으면 취한 사람에게 이중 처벌이 된다.
 * 폭탄은 다르다 — 치지 말아야 할 것을 친 것이므로 감점한다.
 */
export function normalize(score: number): number {
  const ratio = (score / MOLE_COUNT) * 100
  return Math.min(100, Math.max(0, ratio))
}
