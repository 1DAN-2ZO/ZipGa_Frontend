/**
 * 서버 시각 보정.
 *
 * 3·2·1 카운트다운이 전원 동시에 끝나야 하는데 폰 시계는 몇 초씩
 * 어긋나 있는 게 정상이다. 서버와의 차이를 재서 보정한 시각을 쓴다.
 */

export interface ClockDeps {
  /** 서버의 현재 시각(ms). 보통 server_now RPC를 감싼다. */
  fetchServerNowMs: () => Promise<number>
  /** 이 기기의 현재 시각(ms). 보통 Date.now. */
  localNowMs: () => number
}

export interface Clock {
  /** 서버와 시각을 맞춘다. 실패해도 기존 보정값은 유지된다. */
  sync(): Promise<void>
  /** 보정된 현재 시각(ms) */
  now(): number
  /** 현재 보정폭(ms). 양수면 폰 시계가 느리다는 뜻. */
  offsetMs(): number
}

export function createClock(deps: ClockDeps): Clock {
  let offset = 0

  return {
    async sync(): Promise<void> {
      const sentAt = deps.localNowMs()
      // 실패 시 여기서 throw되고 offset은 손대지 않는다.
      const serverMs = await deps.fetchServerNowMs()
      const receivedAt = deps.localNowMs()

      // 서버가 응답한 시점의 로컬 시각을 왕복의 중간으로 본다.
      const localAtServerMoment = (sentAt + receivedAt) / 2
      offset = serverMs - localAtServerMoment
    },

    now(): number {
      return deps.localNowMs() + offset
    },

    offsetMs(): number {
      return offset
    },
  }
}
