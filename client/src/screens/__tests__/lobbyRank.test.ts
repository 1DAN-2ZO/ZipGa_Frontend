import { rankDelta } from '../lobbyRank'

describe('rankDelta', () => {
  it('이전 순위가 없으면 new다', () => {
    expect(rankDelta(1, undefined)).toBe('new')
  })

  it('숫자가 작아지면(등수가 오르면) up이다', () => {
    expect(rankDelta(1, 3)).toBe('up')
  })

  it('숫자가 커지면(등수가 내려가면) down이다', () => {
    expect(rankDelta(3, 1)).toBe('down')
  })

  it('같으면 same이다', () => {
    expect(rankDelta(2, 2)).toBe('same')
  })
})
