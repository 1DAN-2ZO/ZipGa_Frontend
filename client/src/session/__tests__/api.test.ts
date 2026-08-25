import type { GameResult } from '../../games/types'
import { endSession, serverNowMs, SessionError, startSession, submitScore } from '../api'

function okClient(data: unknown) {
  const calls: Array<{ fn: string; args?: Record<string, unknown> }> = []
  return {
    calls,
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      calls.push({ fn, args })
      return { data, error: null }
    },
  }
}

function errClient(message: string) {
  return {
    calls: [] as unknown[],
    rpc: async () => ({ data: null, error: { message } }),
  }
}

const RESULT: GameResult = {
  normalizedScore: 87.5,
  score: 18,
  tiebreakMs: 24310,
  finished: true,
}

describe('serverNowMs', () => {
  it('타임스탬프를 ms로 바꿔준다', async () => {
    const client = okClient('2026-08-25T12:00:00.000Z')
    expect(await serverNowMs(client)).toBe(Date.parse('2026-08-25T12:00:00.000Z'))
  })
})

describe('startSession', () => {
  it('첫 행을 카멜케이스로 바꿔 돌려준다', async () => {
    const client = okClient([
      { session_id: 's1', seed: 42, starts_at: '2026-08-25T12:00:05.000Z' },
    ])
    expect(await startSession(client)).toEqual({
      sessionId: 's1',
      seed: 42,
      startsAt: '2026-08-25T12:00:05.000Z',
    })
  })

  it('방장이 아니면 NOT_HOST로 번역한다', async () => {
    const client = errClient('NOT_HOST')
    await expect(startSession(client)).rejects.toThrow(SessionError)
    await expect(startSession(client)).rejects.toMatchObject({ code: 'NOT_HOST' })
  })

  it('인원이 부족하면 NOT_ENOUGH_PLAYERS로 번역한다', async () => {
    const client = errClient('NOT_ENOUGH_PLAYERS')
    await expect(startSession(client)).rejects.toMatchObject({
      code: 'NOT_ENOUGH_PLAYERS',
    })
  })

  it('메시지에 접두사가 붙어 있어도 코드를 찾아낸다', async () => {
    // Postgres는 'P0001: NOT_HOST' 처럼 감싸서 보낼 수 있다
    const client = errClient('P0001: NOT_HOST')
    await expect(startSession(client)).rejects.toMatchObject({ code: 'NOT_HOST' })
  })

  it('모르는 에러는 UNKNOWN으로 두고 원문을 남긴다', async () => {
    const client = errClient('connection reset by peer')
    await expect(startSession(client)).rejects.toMatchObject({
      code: 'UNKNOWN',
      message: 'connection reset by peer',
    })
  })
})

describe('submitScore', () => {
  it('RPC 인자 이름을 백엔드 규약대로 보낸다', async () => {
    const client = okClient(null)
    await submitScore(client, { sessionId: 's1', roundIndex: 2, result: RESULT })

    expect(client.calls[0]).toEqual({
      fn: 'submit_score',
      args: {
        p_session_id: 's1',
        p_round_index: 2,
        p_normalized: 87.5,
        p_raw_score: 18,
        p_tiebreak_ms: 24310,
        p_finished: true,
      },
    })
  })

  it('세션이 끝났으면 SESSION_NOT_ACTIVE로 번역한다', async () => {
    const client = errClient('SESSION_NOT_ACTIVE')
    await expect(
      submitScore(client, { sessionId: 's1', roundIndex: 0, result: RESULT }),
    ).rejects.toMatchObject({ code: 'SESSION_NOT_ACTIVE' })
  })
})

describe('endSession', () => {
  it('판정 결과를 카멜케이스로 바꿔준다', async () => {
    const client = okClient([
      { player_id: 'p1', nickname: '덕현', avg_score: 72.5, penalized: false },
      { player_id: 'p2', nickname: '민수', avg_score: 31.0, penalized: true },
    ])

    expect(await endSession(client, 's1')).toEqual([
      { playerId: 'p1', nickname: '덕현', avgScore: 72.5, penalized: false },
      { playerId: 'p2', nickname: '민수', avgScore: 31.0, penalized: true },
    ])
  })

  it('빈 결과도 그대로 통과시킨다', async () => {
    expect(await endSession(okClient([]), 's1')).toEqual([])
  })
})
