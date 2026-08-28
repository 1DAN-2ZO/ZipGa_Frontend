import { createRng } from '../prng'
import { PENALTY_THRESHOLD } from '../types'
import type { GameResult } from '../types'

/** 고양이 색. 이 네 가지가 전부다. */
export type CatColor = 'black' | 'red' | 'white' | 'blue'

/** 고양이를 보낼 방향 */
export type Side = 'left' | 'right'

/** 쓰는 색 전부. 좌우 배분은 판마다 시드로 정해진다. */
export const ALL_COLORS: readonly CatColor[] = ['black', 'red', 'white', 'blue']

/**
 * 이 판의 색 배치.
 *
 * 예전에는 검정·빨강이 항상 왼쪽, 흰색·파랑이 항상 오른쪽으로 고정이었다.
 * 그러면 몇 판만 해도 색만 보고 손이 먼저 나가서, 문지기를 볼 이유가 없어진다.
 * 판마다 섞으면 매번 문지기를 읽고 판단하게 된다 — 화면 양옆에 색과 이름을
 * 항상 세워두므로 외우는 게임이 되지는 않는다.
 */
export interface Lineup {
  /** 왼쪽으로 보내야 하는 두 색 */
  left: readonly CatColor[]
  /** 오른쪽으로 보내야 하는 두 색 */
  right: readonly CatColor[]
  /**
   * 초반에 쓰는 두 색.
   *
   * 반드시 좌우에서 하나씩 뽑는다. 같은 쪽 두 색이 걸리면 앞의 여덟 마리가
   * 전부 한 방향이라 좌우 감각을 잡는 구간이 통째로 무의미해진다.
   */
  easy: readonly CatColor[]
}

/**
 * 시드로 이 판의 색 배치를 정한다. 좌우는 항상 2:2다.
 *
 * 한쪽이 3색이 되면 그 판은 한 방향으로 쏠려서 찍기가 유리해진다.
 *
 * 살짝 비튼 시드를 쓰는 이유: makeCats도 같은 시드를 쓰는데 둘 다 같은
 * 난수 흐름을 처음부터 읽으면 배치와 고양이 순서가 얽힌다.
 * (spotDiff의 PHOTO_ORDER_SALT와 같은 이유)
 */
const LINEUP_SALT = 0x27d4eb2f

export function makeLineup(seed: number): Lineup {
  const shuffled = createRng(seed ^ LINEUP_SALT).shuffle(ALL_COLORS)
  const left = [shuffled[0], shuffled[1]]
  const right = [shuffled[2], shuffled[3]]
  return {
    left,
    right,
    // 좌우에서 하나씩 — 초반 두 색은 반드시 서로 반대쪽이다
    easy: [left[0], right[0]],
  }
}

/** 그 색이 이 판에서 가야 할 쪽. */
export function sideOf(lineup: Lineup, color: CatColor): Side {
  return lineup.left.includes(color) ? 'left' : 'right'
}

/**
 * 화면에 띄우는 색 이름.
 *
 * 색만으로 구분하게 두면 색약인 사람이 아예 못 하는 게임이 된다.
 * 고양이에도 문지기에도 이 이름을 같이 붙인다.
 */
export const COLOR_LABELS: Record<CatColor, string> = {
  black: '검정',
  red: '빨강',
  white: '흰색',
  blue: '파랑',
}

/**
 * 이 마리째부터 네 색으로 늘어난다.
 *
 * 첫 판부터 네 색이 나오면 규칙을 읽기도 전에 틀린다.
 * 앞의 몇 마리로 좌우 감각을 잡게 한 뒤 색을 늘린다.
 */
export const RAMP_AT = 8

/**
 * normalizedScore 100의 기준이 되는 "맞힌 마리 수".
 *
 * 대기줄이 보여서 미리 읽을 수 있으므로 한 마리씩 보여줄 때보다 기준을 올려 잡는다.
 * 20초에 40마리면 한 마리당 0.5초다. 화면에는 노출하지 않는다 —
 * 플레이어에게 보이는 건 "지금 몇 마리 보냈나"뿐이다.
 *
 * 34에서 40으로 올렸다. 통과선(MIN_CORRECT)을 30으로 올리면서 같이 움직인
 * 값이다 — 둘 사이가 4마리뿐이면 통과선에서 100점까지가 한 마리당 15점씩
 * 뛰어서 점수가 계단이 된다.
 */
export const PERFECT_COUNT = 40

/**
 * 통과에 필요한 최소 정답 수.
 *
 * 개수만 보면 몇 마리 안 보내고도 통과선을 넘길 수 있었다. 세 판 평균으로
 * 벌칙을 정하는 게임이라, 한 판을 대충 하고도 통과하면 나머지가 무의미해진다.
 *
 * 20에서 30으로 올렸다. 20초에 30마리면 한 마리당 0.67초 — 통과선 자체가
 * 꽤 빠듯하다. PERFECT_COUNT도 같이 올려 그 위 구간을 남겨뒀다.
 */
export const MIN_CORRECT = 30

/**
 * 통과에 필요한 최소 정확도 (맞힌 수 / 시도한 수).
 *
 * 개수 조건만 두면 아무 쪽이나 빠르게 눌러서 개수를 채우는 게 통한다.
 * 보고 판단하는 게임이려면 얼마나 맞혔는지도 봐야 한다.
 *
 * 0.6에서 0.7로 올렸다. 열에 셋을 틀리고도 통과하는 건 "보고 판단했다"고
 * 하기 어렵다.
 */
export const MIN_ACCURACY = 0.7

/**
 * 틀렸을 때 깎는 점수.
 *
 * 안 깎으면 아무 쪽이나 찍는 게 손해가 아니라서 보고 판단할 이유가 없어진다.
 * 맞히면 +1, 틀리면 -1이라 반타작은 정확히 0점이다.
 */
export const WRONG_PENALTY = 1

/**
 * 오답일 때 잠기는 시간(ms).
 *
 * 점수를 깎는 것과 별개로 필요하다. 이게 없으면 틀리든 말든 빠르게 난타해서
 * 운으로 점수를 쌓을 수 있다. 잠금이 시간당 시도 횟수를 묶어준다.
 */
export const WRONG_LOCK_MS = 400

/**
 * 미리 만들어 두는 고양이 수.
 *
 * 제한시간 안에는 절대 다 못 쓴다. 매번 새로 뽑지 않고 시작할 때 전부 확정해야
 * 프레임이나 조작 속도와 무관하게 모든 폰이 같은 순서를 본다.
 */
export const CAT_QUEUE_LENGTH = 120

/**
 * 화면에 한 번에 보이는 대기줄 길이.
 *
 * 뒤에 뭐가 오는지 보여야 손이 미리 준비된다. 한 마리씩만 보이면
 * 판단이 아니라 반응속도 대결이 되어 "느긋한 게임" 제약을 어긴다.
 */
export const QUEUE_VISIBLE = 8

/**
 * 시드에서 고양이 줄을 통째로 만든다.
 *
 * 난수 흐름 하나로 끝까지 뽑는다. 마리마다 시드를 새로 만들면
 * 이웃한 시드끼리 패턴이 생겨 좌우가 규칙적으로 반복될 수 있다.
 *
 * 쓰는 색은 이 판의 배치에서 가져온다 — 초반은 easy 두 색, 그 뒤로 네 색.
 */
export function makeCats(seed: number, count: number, lineup: Lineup): CatColor[] {
  const rng = createRng(seed)
  return Array.from({ length: count }, (_, index) => {
    const palette = index < RAMP_AT ? lineup.easy : ALL_COLORS
    return palette[rng.int(0, palette.length - 1)]
  })
}

export interface ComputeResultInput {
  /** 맞힌 수 */
  correct: number
  /** 틀린 수 */
  wrong: number
  /** 마지막 정답까지 걸린 시간(ms) */
  lastCorrectElapsedMs: number
  timeLimitSec: number
  /** 중도 이탈(언마운트)이면 false. 시간을 다 채웠으면 true. */
  finished: boolean
}

/** 시도한 것 중 맞힌 비율. 한 번도 안 눌렀으면 0이다. */
export function accuracyOf(correct: number, wrong: number): number {
  const attempts = correct + wrong
  return attempts === 0 ? 0 : correct / attempts
}

/**
 * 정규화 점수(0~100).
 *
 * 통과선(PENALTY_THRESHOLD)에 닿으려면 두 관문을 다 넘어야 한다 —
 * 최소 MIN_CORRECT개를 맞히고, 정확도가 MIN_ACCURACY 이상이어야 한다.
 * 하나라도 못 넘기면 통과선 아래에서 멈춘다.
 *
 * 예전에는 순점수(맞힌 수 - 틀린 수)만 기준 수로 나눴다. 그러면 조금만
 * 해도 통과선을 넘고, 100점도 너무 쉽게 나왔다.
 *
 * 두 관문을 넘은 뒤에는 맞힌 개수로 100까지 올라간다.
 */
export function normalize(correct: number, wrong: number): number {
  const accuracy = accuracyOf(correct, wrong)

  if (correct < MIN_CORRECT || accuracy < MIN_ACCURACY) {
    // 못 넘은 쪽을 기준으로 준다. 둘 중 하나라도 모자라면 비율이 1 미만이라
    // 통과선 아래에서 자연히 멈춘다 — 따로 자를 필요가 없다.
    const byCount = correct / MIN_CORRECT
    const byAccuracy = accuracy / MIN_ACCURACY
    return Math.max(0, PENALTY_THRESHOLD * Math.min(byCount, byAccuracy))
  }

  // 통과선 위 — MIN_CORRECT에서 PERFECT_COUNT까지가 40점에서 100점이다.
  const extra = (correct - MIN_CORRECT) / (PERFECT_COUNT - MIN_CORRECT)
  return Math.min(100, PENALTY_THRESHOLD + (100 - PENALTY_THRESHOLD) * extra)
}

/**
 * 시간이 끝나도 그때까지 쌓은 점수는 그대로 인정한다. 0점 처리는 계약 위반이다.
 */
export function computeResult({
  correct,
  wrong,
  lastCorrectElapsedMs,
  timeLimitSec,
  finished,
}: ComputeResultInput): GameResult {
  const netScore = correct - wrong * WRONG_PENALTY
  return {
    normalizedScore: normalize(correct, wrong),
    // 화면에 보여주는 값은 그대로 순점수다. 음수일 수 있다.
    score: netScore,
    // 점수를 못 쌓았으면 "가장 느린 사람"으로 둔다. 0으로 두면 꼴찌가 동점 1등이 된다.
    tiebreakMs: correct > 0 ? lastCorrectElapsedMs : timeLimitSec * 1000,
    finished,
  }
}
