import { act, fireEvent, render, screen } from '@testing-library/react-native'
import React from 'react'
import { whackAMole } from '../whackAMole'
import {
  BOMB_COUNT,
  buildSpawns,
  countMoles,
  HOLE_COUNT,
  netScore,
  normalize,
  type Spawn,
} from '../whackAMole/logic'

const Game = whackAMole.Component
const LIMIT = whackAMole.info.timeLimitSec
const DURATION = LIMIT * 1000
/** 제한시간을 확실히 넘기는 값. */
const PAST_END = DURATION + 200

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

/** RNTL 14의 render는 비동기다. await하지 않으면 쿼리도 마운트도 얻지 못한다. */
async function renderGame(seed = 7) {
  const onFinish = jest.fn()
  await render(<Game seed={seed} timeLimitSec={LIMIT} onFinish={onFinish} />)

  /**
   * RNTL 14의 fireEvent도 비동기다. await하지 않으면 act 스코프가 다음
   * 테스트로 새어 나가 그쪽 렌더를 통째로 날려버린다.
   */
  const strike = async (hole: number) => {
    await act(async () => {
      fireEvent.press(screen.getByTestId(`hole-${hole}`))
    })
  }

  return {
    onFinish,
    strike,
    result: () => onFinish.mock.calls[0]?.[0],
    spawns: buildSpawns(seed, DURATION),
  }
}

/** 그 등장물이 떠 있는 한가운데 시각. */
const midOf = (s: Spawn) => Math.floor((s.showAtMs + s.hideAtMs) / 2)

/** 등장 순서대로 n개를 치고, 매번 그 시각까지 시간을 진행시킨다. */
async function strikeInOrder(
  targets: Spawn[],
  strike: (hole: number) => Promise<void>,
) {
  let at = 0
  for (const s of targets) {
    const mid = midOf(s)
    await advance(mid - at)
    at = mid
    await strike(s.hole)
  }
  return at
}

describe('whackAMole 모듈 정보', () => {
  it('계약이 요구하는 정보를 모두 갖는다', () => {
    expect(whackAMole.info.id).toBe('whackAMole')
    expect(whackAMole.info.name).toBeTruthy()
    expect(whackAMole.info.emoji).toBeTruthy()
    expect(whackAMole.info.desc).toBeTruthy()
    expect(whackAMole.info.timeLimitSec).toBeGreaterThan(0)
  })
})

describe('whackAMole 화면', () => {
  it('구멍 9개를 그린다', async () => {
    await renderGame()
    for (let h = 0; h < HOLE_COUNT; h++) {
      expect(screen.getByTestId(`hole-${h}`)).toBeTruthy()
    }
  })

  it('제한시간이 지나면 스스로 종료한다', async () => {
    const { onFinish, result } = await renderGame()
    await advance(PAST_END)

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(result()).toMatchObject({ finished: true })
  })

  it('아무것도 안 치면 0점이다', async () => {
    const { result } = await renderGame()
    await advance(PAST_END)

    expect(result()).toMatchObject({ score: 0, normalizedScore: 0 })
  })

  it('두더지를 잡으면 점수가 오른다', async () => {
    const { spawns, strike, result } = await renderGame()
    const moles = spawns.filter((s) => s.kind === 'mole').slice(0, 3)

    const at = await strikeInOrder(moles, strike)
    await advance(PAST_END - at)

    expect(result()).toMatchObject({ score: 3, normalizedScore: normalize(3, countMoles(spawns)) })
  })

  it('폭탄을 치면 점수가 깎인다', async () => {
    const { spawns, strike, result } = await renderGame()
    const moles = spawns.filter((s) => s.kind === 'mole').slice(0, 3)
    const bomb = spawns.find((s) => s.kind === 'bomb')!
    const targets = [...moles, bomb].sort((a, b) => a.showAtMs - b.showAtMs)

    const at = await strikeInOrder(targets, strike)
    await advance(PAST_END - at)

    expect(result().score).toBe(netScore(3, 1))
  })

  it('폭탄을 놔두면 아무 일도 없다', async () => {
    const { spawns, strike, result } = await renderGame()
    const moles = spawns.filter((s) => s.kind === 'mole').slice(0, 3)

    const at = await strikeInOrder(moles, strike)
    await advance(PAST_END - at)

    // 폭탄이 3개 지나갔지만 치지 않았으므로 감점이 없다.
    expect(result().score).toBe(3)
  })

  it('폭탄만 쳐도 점수가 0 아래로 안 내려간다', async () => {
    const { spawns, strike, result } = await renderGame()
    const bombs = spawns.filter((s) => s.kind === 'bomb')
    expect(bombs).toHaveLength(BOMB_COUNT)

    const at = await strikeInOrder(bombs, strike)
    await advance(PAST_END - at)

    expect(result().score).toBe(0)
    expect(result().normalizedScore).toBe(0)
  })

  it('같은 것을 두 번 쳐도 한 번만 센다', async () => {
    const { spawns, strike, result } = await renderGame()
    const mole = spawns.find((s) => s.kind === 'mole')!

    await advance(midOf(mole))
    await strike(mole.hole)
    await strike(mole.hole)
    await advance(PAST_END - midOf(mole))

    expect(result().score).toBe(1)
  })

  it('빈 구멍을 쳐도 점수가 깎이지 않는다', async () => {
    const { spawns, strike, result } = await renderGame()
    const mole = spawns.find((s) => s.kind === 'mole')!
    const mid = midOf(mole)

    await advance(mid)

    const open = new Set(
      spawns.filter((s) => s.showAtMs <= mid && mid < s.hideAtMs).map((s) => s.hole),
    )
    const empty = Array.from({ length: HOLE_COUNT }, (_, h) => h).find((h) => !open.has(h))
    expect(empty).toBeDefined()

    await strike(empty as number)
    await strike(mole.hole)
    await advance(PAST_END - mid)

    expect(result().score).toBe(1)
  })

  it('종료 후 시간이 더 흘러도 onFinish를 다시 부르지 않는다', async () => {
    const { onFinish } = await renderGame()

    await advance(PAST_END)
    await advance(10_000)

    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('반환값이 계약 범위 안이다', async () => {
    const { result } = await renderGame(99)
    await advance(PAST_END)

    const r = result()
    expect(r.normalizedScore).toBeGreaterThanOrEqual(0)
    expect(r.normalizedScore).toBeLessThanOrEqual(100)
    expect(r.tiebreakMs).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(countMoles(buildSpawns(99, DURATION)))
  })
})
