import type { ComponentType } from 'react'

/** 벌칙 기준선. 세션 3판 평균이 이 값 미만이면 집에 간다. */
export const PENALTY_THRESHOLD = 40

/** 한 세션에서 연속으로 진행하는 판 수. */
export const ROUNDS_PER_SESSION = 3

/** 게임당 한 번 선언하는 정보. */
export interface GameInfo {
  /** 고유 식별자. 폴더명과 같게 한다. */
  id: string
  /** 표시 이름 */
  name: string
  /** 아이콘 */
  emoji: string
  /** 한 줄 설명 */
  desc: string
  /** 기본 제한시간(초) */
  timeLimitSec: number
}

/** 게임이 앱에 돌려주는 값. */
export interface GameResult {
  /** 0~100. 항상 높을수록 좋다. 판정에 쓰이는 유일한 값. */
  normalizedScore: number
  /** 원점수. 화면 표시 전용이며 계산에 쓰이지 않는다. */
  score: number
  /** 걸린 시간(ms). 동점 판별용 — 항상 작을수록 유리하다. */
  tiebreakMs: number
  /**
   * 게임이 정상적으로 끝났는지.
   *
   * true  — 과제를 다 끝냈거나, 제한시간을 정상적으로 소진했다
   * false — 중도 이탈(앱 종료·화면 이탈)로 끊겼다
   *
   * 두더지 잡기나 연타처럼 끝낼 과제가 없는 지속형 게임은 시간 만료가
   * 곧 정상 종료다. 이런 게임에서 시간 초과를 false로 두면 "중도 이탈"로
   * 잘못 읽힌다. 얼마나 잘했는지는 normalizedScore가, 얼마나 빨랐는지는
   * tiebreakMs가 맡는다. 이 값은 모듈이 제 역할을 하고 끝났는지만 알린다.
   */
  finished: boolean
}

/** 게임이 앱으로부터 받는 값. */
export interface GameProps {
  /** 랜덤 시드. 모든 플레이어가 동일한 값을 받는다. */
  seed: number
  /** 이 판의 제한시간(초) */
  timeLimitSec: number
  /** 종료 시 정확히 한 번 호출한다. */
  onFinish: (result: GameResult) => void
}

/** registry에 등록되는 단위. */
export interface GameModule {
  info: GameInfo
  Component: ComponentType<GameProps>
}

/**
 * 게임이 계약을 지켰는지 검사한다.
 *
 * 담당자가 여럿이라 범위를 벗어난 값이 올라올 수 있다.
 * 호스트가 개발 모드에서 호출해 즉시 드러내는 용도다.
 *
 * @returns 문제 설명 목록. 빈 배열이면 정상.
 */
export function validateGameResult(result: GameResult, gameId: string): string[] {
  const problems: string[] = []

  if (!Number.isFinite(result.normalizedScore) ||
      result.normalizedScore < 0 ||
      result.normalizedScore > 100) {
    problems.push(
      `[${gameId}] normalizedScore는 0~100이어야 하는데 ${result.normalizedScore}를 반환했습니다.`,
    )
  }

  if (!Number.isFinite(result.score)) {
    problems.push(`[${gameId}] score는 유한한 수여야 하는데 ${result.score}를 반환했습니다.`)
  }

  if (!Number.isFinite(result.tiebreakMs) || result.tiebreakMs < 0) {
    problems.push(
      `[${gameId}] tiebreakMs는 0 이상이어야 하는데 ${result.tiebreakMs}를 반환했습니다.`,
    )
  }

  return problems
}
