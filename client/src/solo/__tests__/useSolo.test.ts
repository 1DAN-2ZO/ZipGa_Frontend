import { act, renderHook } from '@testing-library/react-native'
import type { GameModule, GameResult } from '../../games/types'
import { ROUNDS_PER_SESSION } from '../../games/types'
import { BRIEFING_MS } from '../../session/useSession'
import { useSolo } from '../useSolo'

function fakeGame(id: string): GameModule {
  return {
    info: { id, name: id, emoji: '🎮', desc: id, timeLimitSec: 10 },
    Component: () => null,
  }
}
const POOL = [fakeGame('a'), fakeGame('b'), fakeGame('c'), fakeGame('d')]

function result(normalizedScore: number): GameResult {
  return { normalizedScore, score: 0, tiebreakMs: 100, finished: true }
}

const NOW = 1_000_000
const deps = { pool: POOL, now: () => NOW, drawSeed: () => 4242 }

describe('useSolo', () => {
  it('시작 전에는 아무 판도 안 잡혀 있다', async () => {
    const { result: hook } = await renderHook(() => useSolo(deps))

    expect(hook.current.state).toBeNull()
    expect(hook.current.seed).toBeNull()
  })

  it('시작하면 서버 없이 3판을 편성한다', async () => {
    const { result: hook } = await renderHook(() => useSolo(deps))

    await act(async () => hook.current.start())

    expect(hook.current.seed).toBe(4242)
    expect(hook.current.state?.phase).toBe('lineup')
    expect(hook.current.state?.plan).toHaveLength(ROUNDS_PER_SESSION)
  })

  it('편성된 3판은 서로 다른 게임이다', async () => {
    const { result: hook } = await renderHook(() => useSolo(deps))

    await act(async () => hook.current.start())

    const ids = hook.current.state!.plan.map((r) => r.gameId)
    expect(new Set(ids).size).toBe(ROUNDS_PER_SESSION)
  })

  it('같은 시드는 방 세션과 같은 편성을 낸다 — 혼자 하기도 규칙은 하나다', async () => {
    const { result: hook } = await renderHook(() => useSolo(deps))

    await act(async () => hook.current.start())

    const { planSession } = require('../../session/lineup')
    expect(hook.current.state!.plan).toEqual(planSession(4242, POOL))
  })

  it('카운트다운 기준은 시작 버튼이 아니라 게임 공개가 끝날 때 잡힌다', async () => {
    const { result: hook } = await renderHook(() => useSolo(deps))

    await act(async () => hook.current.start())
    // 공개 연출이 4초 가까이 걸린다. 여기서 기준을 잡으면 카운트다운이 통째로 지나간다.
    expect(hook.current.startsAtMs).toBeNull()

    await act(async () => hook.current.advance({ type: 'LINEUP_SHOWN' }))
    expect(hook.current.startsAtMs).toBe(NOW + BRIEFING_MS)
  })

  it('3판을 다 끝내면 final로 간다', async () => {
    const { result: hook } = await renderHook(() => useSolo(deps))

    await act(async () => hook.current.start())
    await act(async () => hook.current.advance({ type: 'LINEUP_SHOWN' }))

    for (let round = 0; round < ROUNDS_PER_SESSION; round += 1) {
      await act(async () => hook.current.advance({ type: 'COUNTDOWN_DONE' }))
      await act(async () => hook.current.advance({ type: 'ROUND_FINISHED', result: result(60) }))
      expect(hook.current.state?.phase).toBe('roundResult')
      await act(async () => hook.current.advance({ type: 'ROUND_RESULT_DONE' }))
    }

    expect(hook.current.state?.phase).toBe('final')
    expect(hook.current.state?.results.map((r) => r.normalizedScore)).toEqual([60, 60, 60])
  })

  it('판 사이마다 카운트다운 기준을 다시 잡는다', async () => {
    let now = NOW
    const { result: hook } = await renderHook(() =>
      useSolo({ pool: POOL, drawSeed: () => 4242, now: () => now }),
    )

    await act(async () => hook.current.start())
    await act(async () => hook.current.advance({ type: 'LINEUP_SHOWN' }))
    await act(async () => hook.current.advance({ type: 'COUNTDOWN_DONE' }))
    await act(async () => hook.current.advance({ type: 'ROUND_FINISHED', result: result(60) }))

    now = NOW + 30_000
    await act(async () => hook.current.advance({ type: 'ROUND_RESULT_DONE' }))

    expect(hook.current.startsAtMs).toBe(now + BRIEFING_MS)
  })

  it('reset하면 다시 시작 전으로 돌아간다', async () => {
    const { result: hook } = await renderHook(() => useSolo(deps))

    await act(async () => hook.current.start())
    await act(async () => hook.current.reset())

    expect(hook.current.state).toBeNull()
    expect(hook.current.seed).toBeNull()
    expect(hook.current.startsAtMs).toBeNull()
  })

  it('다시 시작하면 시드를 새로 뽑는다', async () => {
    let seed = 1111
    const { result: hook } = await renderHook(() =>
      useSolo({ pool: POOL, now: () => NOW, drawSeed: () => seed }),
    )

    await act(async () => hook.current.start())
    await act(async () => hook.current.reset())
    seed = 2222
    await act(async () => hook.current.start())

    expect(hook.current.seed).toBe(2222)
  })
})
