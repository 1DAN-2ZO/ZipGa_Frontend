import { createRng } from '../prng'
import type { GameResult } from '../types'

/**
 * normalizedScore 100의 기준이 되는 정답 개수.
 *
 * 화면에는 절대 노출하지 않는다 — 플레이어에게 보이는 건 "지금 몇 개 맞췄나"뿐이고,
 * 이 값은 벌칙 판정(세션 평균 < PENALTY_THRESHOLD)을 위해 앱이 내부적으로 쓰는 환산 기준이다.
 */
export const PERFECT_COUNT = 5

export interface ComputeResultInput {
  correctCount: number
  lastCorrectElapsedMs: number
  timeLimitSec: number
  /** 문장 풀을 끝까지 소진했는지. 시간 만료로 끝났으면 false. */
  finished: boolean
}

/**
 * 개수형 정규화 (설계 §3.5) — `맞힌 수 / 기준 수 × 100`, 0~100으로 clamp.
 *
 * 시간이 만료돼도 그때까지 맞힌 개수를 그대로 환산한다. 0점 처리는 계약 위반이다.
 */
export function computeResult({
  correctCount,
  lastCorrectElapsedMs,
  timeLimitSec,
  finished,
}: ComputeResultInput): GameResult {
  const normalizedScore = Math.min(100, Math.max(0, (correctCount / PERFECT_COUNT) * 100))

  return {
    normalizedScore,
    score: correctCount,
    // 하나도 못 맞혔으면 "가장 느린 사람"으로 둔다. 0으로 두면 꼴찌가 동점 1등이 된다.
    tiebreakMs: correctCount > 0 ? lastCorrectElapsedMs : timeLimitSec * 1000,
    finished,
  }
}

/**
 * 제시 문장과 입력이 완전히 일치하는지.
 *
 * 앞뒤 공백만 봐준다. 중간 공백·문장부호·오타는 전부 오답이다 —
 * "똑같이 따라 쓴다"가 이 게임의 규칙 전부이므로 여기서 봐주기 시작하면 게임이 사라진다.
 */
export function isExactMatch(input: string, target: string): boolean {
  return input.trim() === target.trim()
}

/**
 * seed로 결정되는 문장 순서. 같은 seed → 항상 같은 배열.
 *
 * 무작위성은 전부 공유 PRNG(`../prng`)에서 나온다. Math.random()은 쓰지 않는다.
 */
export function buildSequence(seed: number, pool: readonly string[]): string[] {
  return createRng(seed).shuffle(pool)
}
