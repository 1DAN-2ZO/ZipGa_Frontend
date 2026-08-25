/**
 * 시드 기반 난수 생성기.
 *
 * 모든 미니게임의 무작위 요소는 반드시 여기서 파생시킨다.
 * Math.random()을 쓰면 폰마다 다른 문제가 나와 공정성이 깨진다.
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Rng {
  /** [0, 1) 실수 */
  next(): number
  /** min 이상 max 이하의 정수 */
  int(min: number, max: number): number
  /** 원본을 건드리지 않고 섞은 새 배열 */
  shuffle<T>(items: readonly T[]): T[]
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed)
  return {
    next,
    int(min: number, max: number): number {
      return min + Math.floor(next() * (max - min + 1))
    },
    shuffle<T>(items: readonly T[]): T[] {
      const arr = [...items]
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        const tmp = arr[i]
        arr[i] = arr[j]
        arr[j] = tmp
      }
      return arr
    },
  }
}

/** 세션 시드 하나에서 각 판의 시드를 파생시킨다. */
export function deriveRoundSeeds(sessionSeed: number, rounds: number): number[] {
  const rng = mulberry32(sessionSeed)
  const seeds: number[] = []
  for (let i = 0; i < rounds; i++) {
    seeds.push(Math.floor(rng() * 2147483646) + 1)
  }
  return seeds
}
