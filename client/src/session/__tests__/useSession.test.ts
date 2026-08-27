import { act, renderHook, waitFor } from '@testing-library/react-native'
import type { GameModule, GameResult } from '../../games/types'
import type { RpcClient } from '../api'
import { createClock } from '../clock'
import { BRIEFING_MS, useSession } from '../useSession'

function fakeGame(id: string): GameModule {
  return {
    info: { id, name: id, emoji: '🎮', desc: id, timeLimitSec: 10 },
    Component: () => null,
  }
}
const POOL = [fakeGame('a'), fakeGame('b'), fakeGame('c'), fakeGame('d')]

const STARTED = { session_id: 's1', seed: 4242, starts_at: '2026-08-25T12:00:05.000Z' }

function result(normalizedScore: number): GameResult {
  return { normalizedScore, score: 0, tiebreakMs: 100, finished: true }
}

function makeDeps() {
  const calls: Array<{ fn: string; args?: Record<string, unknown> }> = []
  let notify: ((row: typeof STARTED) => void) | null = null

  // RpcClient로 못 박아야 뒤에서 에러를 내는 rpc로 갈아끼울 수 있다
  const client: RpcClient = {
    rpc: async (fn: string, args?: Record<string, unknown>) => {
      calls.push({ fn, args })
      if (fn === 'start_session') return { data: [STARTED], error: null }
      if (fn === 'end_session') {
        return {
          data: [{ player_id: 'p1', nickname: '나', avg_score: 20, penalized: true }],
          error: null,
        }
      }
      return { data: null, error: null }
    },
  }

  return {
    calls,
    fireSessionStart: (row = STARTED) => notify?.(row),
    deps: {
      client,
      clock: createClock({
        fetchServerNowMs: async () => 0,
        localNowMs: () => 0,
      }),
      subscribeSessionStart: (cb: (row: typeof STARTED) => void) => {
        notify = cb
        return () => {
          notify = null
        }
      },
      getSessionParticipantIds: () => ['p1'],
      waitForAllScores: async () => {},
      pool: POOL,
    },
  }
}

/** lineup부터 지정한 점수로 3판을 끝까지 돌린다. */
async function playAll(hook: { current: ReturnType<typeof useSession> }, scores: number[]) {
  await act(async () => hook.current.advance({ type: 'LINEUP_SHOWN' }))
  for (const score of scores) {
    await act(async () => hook.current.advance({ type: 'COUNTDOWN_DONE' }))
    await act(async () => hook.current.advance({ type: 'ROUND_FINISHED', result: result(score) }))
    await act(async () => hook.current.advance({ type: 'ROUND_RESULT_DONE' }))
  }
}

describe('useSession', () => {
  it('시작 전에는 상태가 없다', async () => {
    const { deps } = makeDeps()
    const { result: hook } = await renderHook(() => useSession(deps))
    expect(hook.current.state).toBeNull()
  })

  it('방장이 start를 부르면 3판이 편성된다', async () => {
    const { deps } = makeDeps()
    const { result: hook } = await renderHook(() => useSession(deps))

    await act(async () => {
      await hook.current.start()
    })

    expect(hook.current.state?.phase).toBe('lineup')
    expect(hook.current.state?.plan).toHaveLength(3)
    expect(hook.current.startsAtMs).toBe(Date.parse(STARTED.starts_at))
  })

  it('참가자는 Realtime 알림만으로 같은 편성을 얻는다', async () => {
    const host = makeDeps()
    const guest = makeDeps()

    const { result: hostHook } = await renderHook(() => useSession(host.deps))
    const { result: guestHook } = await renderHook(() => useSession(guest.deps))

    await act(async () => {
      await hostHook.current.start()
    })
    await act(async () => {
      guest.fireSessionStart()
    })

    expect(guestHook.current.state?.plan).toEqual(hostHook.current.state?.plan)
    // 참가자는 start_session을 부르지 않는다
    expect(guest.calls.some((c) => c.fn === 'start_session')).toBe(false)
  })

  it('판이 끝나면 그 판 점수를 제출한다', async () => {
    const { deps, calls } = makeDeps()
    const { result: hook } = await renderHook(() => useSession(deps))

    await act(async () => {
      await hook.current.start()
    })
    await act(async () => hook.current.advance({ type: 'LINEUP_SHOWN' }))
    await act(async () => hook.current.advance({ type: 'COUNTDOWN_DONE' }))
    await act(async () => hook.current.advance({ type: 'ROUND_FINISHED', result: result(87.5) }))

    await waitFor(() => {
      const submitted = calls.find((c) => c.fn === 'submit_score')
      expect(submitted?.args).toMatchObject({
        p_session_id: 's1',
        p_round_index: 0,
        p_normalized: 87.5,
      })
    })
  })

  it('3판이 끝나면 end_session을 부르고 판정을 받는다', async () => {
    const { deps, calls } = makeDeps()
    const { result: hook } = await renderHook(() => useSession(deps))

    await act(async () => {
      await hook.current.start()
    })
    await playAll(hook, [80, 70, 60])

    await waitFor(() => {
      expect(calls.some((c) => c.fn === 'end_session')).toBe(true)
      expect(hook.current.verdict).toEqual([
        { playerId: 'p1', nickname: '나', avgScore: 20, penalized: true },
      ])
    })
  })

  it('마지막 판 제출이 서버에 닿기 전에는 end_session을 부르지 않는다', async () => {
    // roundResult 화면은 로컬 타이머로 스스로 넘어가므로, 그 판의 submit_score
    // 요청이 아직 서버에 안 닿았어도 3판째 이후 phase는 곧장 final로 간다.
    // 이때 end_session이 먼저 나가버리면 서버는 그 판을 "제출 없음=0점"으로
    // 채점한다 — 분명 통과권이었는데 평균이 깎이는 원인이다.
    const { deps, calls } = makeDeps()
    let resolveLastSubmit: (() => void) | null = null
    const originalRpc = deps.client.rpc
    deps.client.rpc = (fn, args) => {
      if (fn === 'submit_score' && (args as { p_round_index?: number })?.p_round_index === 2) {
        return new Promise((resolve) => {
          resolveLastSubmit = () => resolve(originalRpc(fn, args))
        })
      }
      return originalRpc(fn, args)
    }

    const { result: hook } = await renderHook(() => useSession(deps))
    await act(async () => hook.current.start())
    await act(async () => hook.current.advance({ type: 'LINEUP_SHOWN' }))
    for (const score of [80, 70]) {
      await act(async () => hook.current.advance({ type: 'COUNTDOWN_DONE' }))
      await act(async () => hook.current.advance({ type: 'ROUND_FINISHED', result: result(score) }))
      await act(async () => hook.current.advance({ type: 'ROUND_RESULT_DONE' }))
    }
    await act(async () => hook.current.advance({ type: 'COUNTDOWN_DONE' }))
    await act(async () => hook.current.advance({ type: 'ROUND_FINISHED', result: result(60) }))
    await act(async () => hook.current.advance({ type: 'ROUND_RESULT_DONE' }))

    // 3판째 제출이 아직 안 끝났다 — end_session이 불려선 안 된다.
    expect(calls.some((c) => c.fn === 'end_session')).toBe(false)

    await act(async () => resolveLastSubmit?.())

    await waitFor(() => {
      expect(calls.some((c) => c.fn === 'end_session')).toBe(true)
    })
  })

  it('end_session은 한 번만 부른다', async () => {
    const { deps, calls } = makeDeps()
    const { result: hook } = await renderHook(() => useSession(deps))

    await act(async () => {
      await hook.current.start()
    })
    await playAll(hook, [80, 70, 60])
    await waitFor(() => expect(hook.current.verdict).not.toBeNull())

    await act(async () => hook.current.advance({ type: 'ROUND_RESULT_DONE' }))
    expect(calls.filter((c) => c.fn === 'end_session')).toHaveLength(1)
  })

  it('2판째 카운트다운은 판마다 새 기준을 잡는다', async () => {
    // 서버 starts_at은 세션당 한 번뿐이라 2판째에는 이미 지나 있다. 그대로 두면
    // 남은 시간이 음수라 카운트다운이 첫 틱에 끝나고, 그 화면이 들고 있는
    // 게임 설명(이름·한 줄 설명·제한시간)이 통째로 안 보인다.
    const { deps } = makeDeps()
    const { result: hook } = await renderHook(() => useSession(deps))

    await act(async () => hook.current.start())
    await waitFor(() => expect(hook.current.state).not.toBeNull())
    expect(hook.current.startsAtMs).toBe(Date.parse(STARTED.starts_at))

    await act(async () => hook.current.advance({ type: 'LINEUP_SHOWN' }))
    await act(async () => hook.current.advance({ type: 'COUNTDOWN_DONE' }))
    await act(async () => hook.current.advance({ type: 'ROUND_FINISHED', result: result(50) }))
    await act(async () => hook.current.advance({ type: 'ROUND_RESULT_DONE' }))

    // 2판째 카운트다운 진입. 기준이 "지금부터 BRIEFING_MS 뒤"로 다시 잡혀야 한다.
    expect(hook.current.state?.phase).toBe('countdown')
    expect(hook.current.state?.roundIndex).toBe(1)
    expect(hook.current.startsAtMs).toBe(deps.clock.now() + BRIEFING_MS)
  })

  it('시작에 실패하면 에러 코드를 노출한다', async () => {
    const { deps } = makeDeps()
    deps.client.rpc = async () => ({ data: null, error: { message: 'NOT_HOST' } })

    const { result: hook } = await renderHook(() => useSession(deps))
    await act(async () => {
      await hook.current.start()
    })

    expect(hook.current.error).toBe('NOT_HOST')
    expect(hook.current.state).toBeNull()
  })

  it('언마운트 시 구독을 정리한다', async () => {
    const { deps } = makeDeps()
    let unsubscribed = false
    deps.subscribeSessionStart = () => () => {
      unsubscribed = true
    }

    const { unmount } = await renderHook(() => useSession(deps))
    await act(async () => {
      unmount()
    })
    expect(unsubscribed).toBe(true)
  })
})
