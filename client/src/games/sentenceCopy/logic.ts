import { createRng } from '../prng'
import { PENALTY_THRESHOLD } from '../types'
import type { GameResult } from '../types'

/**
 * normalizedScore 100의 기준이 되는 정답 개수.
 *
 * 화면에는 절대 노출하지 않는다 — 플레이어에게 보이는 건 "지금 몇 개 맞췄나"뿐이고,
 * 이 값은 벌칙 판정(세션 평균 < PENALTY_THRESHOLD)을 위해 앱이 내부적으로 쓰는 환산 기준이다.
 *
 * 10에서 6으로 내렸다. 20초에 열 개는 사실상 아무도 못 채워서 만점이
 * 죽은 값이었다.
 */
export const PERFECT_COUNT = 6

/**
 * 통과선(PENALTY_THRESHOLD)에 정확히 닿는 정답 개수.
 *
 * 예전에는 표시용 상수였다. 개수를 PERFECT_COUNT로 그냥 나누던 시절에는
 * 통과선에 닿는 개수가 저절로 정해졌기 때문이다 — 다만 그 방식은 100을
 * PERFECT_COUNT로 나눈 값이 40을 정확히 짚을 때만 성립했다(5의 배수).
 * 지금은 통과선과 만점을 각각 정하고 그 사이를 잇는다.
 */
export const PASS_COUNT = 2

export interface ComputeResultInput {
  correctCount: number
  lastCorrectElapsedMs: number
  timeLimitSec: number
  /** 문장 풀을 끝까지 소진했는지. 시간 만료로 끝났으면 false. */
  finished: boolean
}

/**
 * 맞힌 개수를 0~100으로 환산한다.
 *
 * 통과선을 기준으로 두 구간이다 — 0개에서 PASS_COUNT개까지가 0점에서 40점,
 * PASS_COUNT개에서 PERFECT_COUNT개까지가 40점에서 100점. 좌로우로(leftRight)가
 * 쓰는 방식과 같다.
 *
 * 그냥 `맞힌 수 / PERFECT_COUNT × 100`으로 두면 통과 개수와 만점 개수를 따로
 * 정할 수 없다. 2개 통과·6개 만점을 그 식에 넣으면 2개가 33점이라 통과선
 * 아래로 떨어진다.
 */
export function normalize(correctCount: number): number {
  if (correctCount < PASS_COUNT) {
    return Math.max(0, PENALTY_THRESHOLD * (correctCount / PASS_COUNT))
  }
  const extra = (correctCount - PASS_COUNT) / (PERFECT_COUNT - PASS_COUNT)
  return Math.min(100, PENALTY_THRESHOLD + (100 - PENALTY_THRESHOLD) * extra)
}

/**
 * 시간이 만료돼도 그때까지 맞힌 개수를 그대로 환산한다. 0점 처리는 계약 위반이다.
 */
export function computeResult({
  correctCount,
  lastCorrectElapsedMs,
  timeLimitSec,
  finished,
}: ComputeResultInput): GameResult {
  return {
    normalizedScore: normalize(correctCount),
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
/**
 * 된소리(ㄲ ㄸ ㅃ ㅆ ㅉ)가 하나라도 들어있는지.
 *
 * 자판에서 shift 를 눌러야 나오는 글자라 손이 한 박자 늦고, 취하면 그
 * 박자가 통째로 무너진다 — 이 게임이 노리는 난이도가 바로 거기다.
 */
export function hasTenseConsonant(text: string): boolean {
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if (code < HANGUL_FIRST || code > HANGUL_LAST) continue
    const index = code - HANGUL_FIRST
    // 초성 ㄲ ㄸ ㅃ ㅆ ㅉ
    if (TENSE_INITIALS.has(Math.floor(index / 588))) return true
    // 받침 ㄲ ㅆ (ㄸ ㅃ ㅉ 는 받침으로 오지 않는다)
    if (TENSE_FINALS.has(index % 28)) return true
  }
  return false
}

const HANGUL_FIRST = 0xac00
const HANGUL_LAST = 0xd7a3
/** 초성 19자 중 ㄲ ㄸ ㅃ ㅆ ㅉ 의 자리 */
const TENSE_INITIALS = new Set([1, 4, 8, 10, 13])
/** 받침 28자 중 ㄲ ㅆ 의 자리 */
const TENSE_FINALS = new Set([2, 20])

/**
 * 시드로 문장 순서를 정한다. 된소리가 든 문장을 앞에 몰아준다.
 *
 * 한 판에 소비되는 건 많아야 열 개 남짓이라, 앞쪽만 채워도 사실상 매 판
 * 된소리 문장만 나온다. 그렇다고 나머지를 빼지는 않는다 — 풀이 마르면
 * 게임이 끊기고, 잘하는 사람이 뒤쪽까지 가는 것도 정상 경로다.
 *
 * 두 묶음을 같은 난수 흐름으로 섞는다. 시드가 같으면 순서도 같다.
 */
export function buildSequence(seed: number, pool: readonly string[]): string[] {
  const rng = createRng(seed)
  const tense: string[] = []
  const plain: string[] = []
  for (const sentence of pool) {
    (hasTenseConsonant(sentence) ? tense : plain).push(sentence)
  }
  return [...rng.shuffle(tense), ...rng.shuffle(plain)]
}
