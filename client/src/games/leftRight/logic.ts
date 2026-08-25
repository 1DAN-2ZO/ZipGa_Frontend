import { createRng } from '../prng'
import type { GameResult } from '../types'

/** 고양이 색. 이 네 가지가 전부다. */
export type CatColor = 'black' | 'red' | 'white' | 'blue'

/** 고양이를 보낼 방향 */
export type Side = 'left' | 'right'

/**
 * 왼쪽 문지기의 색.
 *
 * 매핑은 시드와 무관하게 고정이고 화면 양옆에 항상 세워둔다.
 * 외우는 게임이 아니라 보고 판단하는 게임이어야 하기 때문이다.
 */
export const LEFT_COLORS: readonly CatColor[] = ['black', 'red']

/** 오른쪽 문지기의 색 */
export const RIGHT_COLORS: readonly CatColor[] = ['white', 'blue']

/** 초반에 쓰는 두 색. 좌우가 한눈에 갈린다. */
export const EASY_COLORS: readonly CatColor[] = ['black', 'white']

/** 후반에 쓰는 네 색 */
export const HARD_COLORS: readonly CatColor[] = [...LEFT_COLORS, ...RIGHT_COLORS]

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
 * 20초에 24마리면 한 마리당 0.83초다. 화면에는 노출하지 않는다 —
 * 플레이어에게 보이는 건 "지금 몇 마리 보냈나"뿐이다.
 */
export const PERFECT_COUNT = 24

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

/** 그 색 고양이가 가야 할 쪽. */
export function sideOf(color: CatColor): Side {
  return LEFT_COLORS.includes(color) ? 'left' : 'right'
}

/**
 * 시드에서 고양이 줄을 통째로 만든다.
 *
 * 난수 흐름 하나로 끝까지 뽑는다. 마리마다 시드를 새로 만들면
 * 이웃한 시드끼리 패턴이 생겨 좌우가 규칙적으로 반복될 수 있다.
 */
export function makeCats(seed: number, count: number): CatColor[] {
  const rng = createRng(seed)
  return Array.from({ length: count }, (_, index) => {
    const palette = index < RAMP_AT ? EASY_COLORS : HARD_COLORS
    return palette[rng.int(0, palette.length - 1)]
  })
}

export interface ComputeResultInput {
  /** 맞힌 수에서 틀린 수를 뺀 값. 음수일 수 있다. */
  netScore: number
  /** 마지막 정답까지 걸린 시간(ms) */
  lastCorrectElapsedMs: number
  timeLimitSec: number
  /** 중도 이탈(언마운트)이면 false. 시간을 다 채웠으면 true. */
  finished: boolean
}

/**
 * 개수형 정규화 (설계 §3.5) — `순점수 / 기준 수 × 100`, 0~100으로 clamp.
 *
 * 많이 틀려 순점수가 음수가 되어도 normalizedScore는 0에서 멈춘다.
 * 계약이 0~100을 요구하기 때문이다 — 화면에 보이는 원점수(score)만 음수로 남는다.
 *
 * 시간이 끝나도 그때까지 쌓은 점수는 그대로 인정한다. 0점 처리는 계약 위반이다.
 */
export function computeResult({
  netScore,
  lastCorrectElapsedMs,
  timeLimitSec,
  finished,
}: ComputeResultInput): GameResult {
  return {
    normalizedScore: Math.min(100, Math.max(0, (netScore / PERFECT_COUNT) * 100)),
    score: netScore,
    // 점수를 못 쌓았으면 "가장 느린 사람"으로 둔다. 0으로 두면 꼴찌가 동점 1등이 된다.
    tiebreakMs: netScore > 0 ? lastCorrectElapsedMs : timeLimitSec * 1000,
    finished,
  }
}
