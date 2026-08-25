import { createRng } from '../prng'

/** 3×3 격자. */
export const HOLE_COUNT = 9

/** 한 판에 나오는 두더지 수. 정규화의 분모가 된다. */
export const MOLE_COUNT = 24

/** 표시 시간. 후반으로 갈수록 END에 가까워져 난이도가 오른다. */
const VISIBLE_START_MS = 1050
const VISIBLE_END_MS = 650

/** 등장 시각을 균등 간격에서 흔드는 폭. 규칙적이면 리듬만 타면 돼서 시시하다. */
const JITTER_MS = 150

export interface Mole {
  /** 0 ~ HOLE_COUNT-1 */
  hole: number
  showAtMs: number
  hideAtMs: number
}

/**
 * 시드에서 두더지 스케줄 전체를 미리 만든다.
 *
 * 매 프레임 난수를 뽑지 않고 시작 시점에 전부 확정한다.
 * 프레임 수가 폰마다 달라도 같은 두더지가 같은 때 나와야 공정하기 때문이다.
 */
export function buildMoles(seed: number, durationMs: number): Mole[] {
  const rng = createRng(seed)
  const moles: Mole[] = []

  /** 구멍별로 마지막 두더지가 들어간 시각. 같은 구멍이 겹치는 것을 막는다. */
  const freeAt = new Array<number>(HOLE_COUNT).fill(0)

  const gap = durationMs / MOLE_COUNT

  for (let i = 0; i < MOLE_COUNT; i++) {
    const progress = i / Math.max(1, MOLE_COUNT - 1)
    const visibleMs = Math.round(
      VISIBLE_START_MS + (VISIBLE_END_MS - VISIBLE_START_MS) * progress,
    )

    const base = i * gap + rng.int(-JITTER_MS, JITTER_MS)
    // 마지막 두더지까지 제한시간 안에 들어가야 한다.
    const showAtMs = Math.round(Math.min(Math.max(base, 0), durationMs - visibleMs))

    // 그 시각에 비어 있는 구멍만 후보로 둔다.
    const free = []
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
    moles.push({ hole, showAtMs: start, hideAtMs })
  }

  return moles.sort((a, b) => a.showAtMs - b.showAtMs)
}

/**
 * 잡은 수를 0~100으로 정규화한다.
 *
 * 헛스윙은 감점하지 않는다. 두더지를 놓치는 것 자체가 이미 페널티이고,
 * 헛스윙까지 깎으면 취한 사람에게 이중 처벌이 된다.
 */
export function normalize(hitCount: number): number {
  const ratio = (hitCount / MOLE_COUNT) * 100
  return Math.min(100, Math.max(0, ratio))
}
