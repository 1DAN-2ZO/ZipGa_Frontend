// presence.ts는 supabase 클라이언트를 끌고 오는데, 여기서 보는 건 순수 계산뿐이다.
jest.mock('../../lib/supabase', () => ({ supabase: { channel: jest.fn() } }))

import { reducePresence, type TrackedPresence } from '../presence'

/** track된 한 줄. at을 안 주면 아주 오래된 접속으로 친다. */
function entry(
  playerId: string,
  ready: boolean,
  at = 1_000,
): TrackedPresence {
  return { playerId, nickname: playerId, ready, at }
}

describe('reducePresence', () => {
  it('접속한 사람을 모두 online으로 센다', () => {
    const { onlinePlayerIds } = reducePresence({
      a: [entry('a', false)],
      b: [entry('b', true)],
    })

    expect([...onlinePlayerIds].sort()).toEqual(['a', 'b'])
  })

  it('준비를 누른 사람만 ready에 담는다', () => {
    const { readyPlayerIds } = reducePresence({
      a: [entry('a', false)],
      b: [entry('b', true)],
    })

    expect([...readyPlayerIds]).toEqual(['b'])
  })

  it('아무도 없으면 둘 다 비어 있다', () => {
    const { onlinePlayerIds, readyPlayerIds } = reducePresence({})

    expect(onlinePlayerIds.size).toBe(0)
    expect(readyPlayerIds.size).toBe(0)
  })

  /**
   * 제보된 버그: 게임이 끝나고 나면 한 번씩 준비완료가 저절로 켜져 있다.
   *
   * 소켓이 끊겼다 붙으면 서버가 옛 접속을 아직 안 거둔 채로 새 접속이
   * 들어와, 같은 사람 앞에 줄이 둘 잡힌다. 예전에는 "하나라도 ready면
   * 준비완료"로 읽어서, 지난 세션에 눌렀던 옛 줄이 남아 있는 동안
   * 아무도 안 눌렀는데 준비완료로 보였다.
   */
  describe('같은 사람 앞에 접속이 둘 잡혔을 때', () => {
    it('오래된 준비완료가 남아 있어도 최신 접속을 따른다', () => {
      const { readyPlayerIds } = reducePresence({
        // 지난 세션에 눌러둔 옛 접속 + 세션이 끝나고 새로 붙은 접속
        a: [entry('a', true, 1_000), entry('a', false, 2_000)],
      })

      expect(readyPlayerIds.has('a')).toBe(false)
    })

    it('줄 순서가 뒤집혀 들어와도 결과가 같다', () => {
      const { readyPlayerIds } = reducePresence({
        a: [entry('a', false, 2_000), entry('a', true, 1_000)],
      })

      expect(readyPlayerIds.has('a')).toBe(false)
    })

    it('최신 접속이 준비완료면 준비완료다', () => {
      const { readyPlayerIds } = reducePresence({
        a: [entry('a', false, 1_000), entry('a', true, 2_000)],
      })

      expect(readyPlayerIds.has('a')).toBe(true)
    })

    it('줄이 둘이어도 online은 한 번만 센다', () => {
      const { onlinePlayerIds } = reducePresence({
        a: [entry('a', true, 1_000), entry('a', false, 2_000)],
      })

      expect(onlinePlayerIds.size).toBe(1)
    })

    it('at이 없는 옛 버전 줄은 가장 오래된 것으로 친다', () => {
      const stale = { playerId: 'a', nickname: 'a', ready: true } as TrackedPresence
      const { readyPlayerIds } = reducePresence({ a: [stale, entry('a', false, 1)] })

      expect(readyPlayerIds.has('a')).toBe(false)
    })
  })
})
