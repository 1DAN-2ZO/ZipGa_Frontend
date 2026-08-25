import { createRng } from './prng'
import type { GameModule } from './types'
import { bulletHell } from './bulletHell'
import { leftRight } from './leftRight'
import { sentenceCopy } from './sentenceCopy'
import { spotDiff } from './spotDiff'

/**
 * 등록된 미니게임 전체.
 *
 * 새 게임을 추가하려면 import 한 줄과 아래 배열에 한 줄만 넣으면 된다.
 * 이 파일이 게임 담당자들의 유일한 공유 지점이다.
 */
export const GAMES: readonly GameModule[] = [sentenceCopy, bulletHell, spotDiff, leftRight]

export function getGame(id: string): GameModule {
  const found = GAMES.find((g) => g.info.id === id)
  if (!found) {
    throw new Error(`등록되지 않은 게임입니다: ${id}`)
  }
  return found
}

/**
 * 주어진 풀에서 시드로 게임을 중복 없이 추첨한다.
 *
 * 풀을 인자로 받는 이유는 등록된 게임이 3개 미만인 개발 중에도
 * 이 로직을 테스트할 수 있어야 하기 때문이다.
 */
export function pickFrom(
  pool: readonly GameModule[],
  sessionSeed: number,
  count: number,
): GameModule[] {
  if (count > pool.length) {
    throw new Error(`게임이 ${pool.length}개뿐인데 ${count}개를 요청했습니다.`)
  }
  return createRng(sessionSeed).shuffle(pool).slice(0, count)
}

/**
 * 등록된 게임 전체에서 추첨한다.
 *
 * 서버는 시드만 내려주고 추첨은 각 폰이 계산한다.
 * 시드가 같으므로 전원이 같은 결과를 얻는다.
 */
export function pickGames(sessionSeed: number, count: number): GameModule[] {
  return pickFrom(GAMES, sessionSeed, count)
}
