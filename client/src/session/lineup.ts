import { deriveRoundSeeds } from '../games/prng'
import { GAMES, pickFrom } from '../games/registry'
import type { GameModule } from '../games/types'
import { ROUNDS_PER_SESSION } from '../games/types'

/** 한 판의 편성. 전원이 시드에서 동일하게 계산해낸다. */
export interface RoundPlan {
  roundIndex: number
  gameId: string
  /** 이 판의 게임에 넘길 시드 */
  seed: number
  timeLimitSec: number
}

/**
 * 세션 시드 하나에서 3판 전체를 편성한다.
 *
 * 서버가 보내는 것은 시드 하나뿐이다. 어떤 게임이 나올지, 각 판의
 * 문제가 무엇일지는 전부 여기서 파생되므로 아무도 개입할 수 없다.
 */
export function planSession(
  sessionSeed: number,
  pool: readonly GameModule[] = GAMES,
): RoundPlan[] {
  const games = pickFrom(pool, sessionSeed, ROUNDS_PER_SESSION)
  const seeds = deriveRoundSeeds(sessionSeed, ROUNDS_PER_SESSION)

  return games.map((game, roundIndex) => ({
    roundIndex,
    gameId: game.info.id,
    seed: seeds[roundIndex],
    timeLimitSec: game.info.timeLimitSec,
  }))
}
