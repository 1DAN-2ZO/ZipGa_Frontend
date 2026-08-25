import { GAMES, getGame, pickGames } from '../registry'

describe('GAMES', () => {
  it('최소 한 개 이상 등록돼 있다', () => {
    expect(GAMES.length).toBeGreaterThan(0)
  })

  it('id가 중복되지 않는다', () => {
    const ids = GAMES.map((g) => g.info.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('모든 게임이 필수 정보를 갖는다', () => {
    for (const g of GAMES) {
      expect(g.info.id).toBeTruthy()
      expect(g.info.name).toBeTruthy()
      expect(g.info.emoji).toBeTruthy()
      expect(g.info.desc).toBeTruthy()
      expect(g.info.timeLimitSec).toBeGreaterThan(0)
      expect(g.Component).toBeDefined()
    }
  })
})

describe('getGame', () => {
  it('등록된 게임을 찾는다', () => {
    expect(getGame('sentenceCopy').info.id).toBe('sentenceCopy')
  })

  it('좌로우로가 등록돼 있다', () => {
    expect(getGame('leftRight').info.id).toBe('leftRight')
  })

  it('없는 id면 에러를 던진다', () => {
    expect(() => getGame('nope')).toThrow('nope')
  })
})

describe('pickGames', () => {
  it('요청한 개수만큼 뽑는다', () => {
    expect(pickGames(123, 1)).toHaveLength(1)
  })

  it('같은 시드는 같은 게임을 같은 순서로 뽑는다', () => {
    const a = pickGames(4242, 1).map((g) => g.info.id)
    const b = pickGames(4242, 1).map((g) => g.info.id)
    expect(a).toEqual(b)
  })

  it('한 세션 안에서 같은 게임이 두 번 나오지 않는다', () => {
    const count = Math.min(3, GAMES.length)
    const ids = pickGames(999, count).map((g) => g.info.id)
    expect(new Set(ids).size).toBe(count)
  })

  it('풀보다 많이 요청하면 에러를 던진다', () => {
    expect(() => pickGames(1, GAMES.length + 1)).toThrow()
  })
})
