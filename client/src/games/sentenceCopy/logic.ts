import { createRng } from '../prng'
import type { GameResult } from '../types'

/**
 * normalizedScore 100의 기준이 되는 정답 개수.
 *
 * 화면에는 절대 노출하지 않는다 — 플레이어에게 보이는 건 "지금 몇 개 맞췄나"뿐이고,
 * 이 값은 벌칙 판정(세션 평균 < PENALTY_THRESHOLD)을 위해 앱이 내부적으로 쓰는 환산 기준이다.
 *
 * 5에서 10으로 올렸다. 20초에 두 개만 쳐도 통과선(40)을 넘어서 너무 헐거웠다.
 * 한 개당 10점이라 4개면 통과선에 닿고 10개면 만점이다.
 */
export const PERFECT_COUNT = 10

/**
 * 통과선에 닿는 정답 개수. 계산에 쓰지 않고 의도를 남기려고 둔다 —
 * PERFECT_COUNT를 건드리면 이 값도 같이 움직이므로 검사로 묶어둔다.
 */
export const PASS_COUNT = 4

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
