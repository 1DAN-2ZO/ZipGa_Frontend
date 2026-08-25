import type { GameModule } from '../../games/types'
import { planSession } from '../lineup'

function fakeGame(id: string, timeLimitSec: number): GameModule {
  return {
    info: { id, name: id, emoji: '🎮', desc: id, timeLimitSec },
    Component: () => null,
  }
}

const POOL: readonly GameModule[] = [
  fakeGame('a', 10),
  fakeGame('b', 20),
  fakeGame('c', 30),
  fakeGame('d', 40),
  fakeGame('e', 50),
]

describe('planSession', () => {
  it('3판을 편성한다', () => {
    expect(planSession(1234, POOL)).toHaveLength(3)
  })

  it('같은 시드는 완전히 같은 편성을 만든다', () => {
    expect(planSession(31337, POOL)).toEqual(planSession(31337, POOL))
  })

  it('다른 시드는 다른 편성을 만든다', () => {
    const a = planSession(1, POOL)
    const b = planSession(2, POOL)
    expect(a).not.toEqual(b)
  })

  it('한 세션 안에서 같은 게임이 두 번 나오지 않는다', () => {
    const ids = planSession(999, POOL).map((r) => r.gameId)
    expect(new Set(ids).size).toBe(3)
  })

  it('roundIndex가 0,1,2 순서로 붙는다', () => {
    expect(planSession(7, POOL).map((r) => r.roundIndex)).toEqual([0, 1, 2])
  })

  it('판마다 서로 다른 시드를 준다', () => {
    const seeds = planSession(7, POOL).map((r) => r.seed)
    expect(new Set(seeds).size).toBe(3)
  })

  it('제한시간은 그 판에 뽑힌 게임의 값을 그대로 쓴다', () => {
    for (const round of planSession(555, POOL)) {
      const game = POOL.find((g) => g.info.id === round.gameId)!
      expect(round.timeLimitSec).toBe(game.info.timeLimitSec)
    }
  })

  it('풀이 3개 미만이면 에러를 던진다', () => {
    expect(() => planSession(1, [fakeGame('only', 10)])).toThrow()
  })
})
