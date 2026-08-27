import { act, fireEvent, render, screen } from '@testing-library/react-native'
import React from 'react'
import { whackAMole } from '../whackAMole'
import { HOLE_COLUMNS, HOLE_COUNT, HOLE_GAP, HOLE_SIZE, bombCountFor, buildSpawns, countMoles, netScore, normalize, type Spawn } from '../whackAMole/logic'

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
  /** 구멍 번호를 그리드 기준 좌표(구멍 한가운데)로 바꾼다 */
  const pointOf = (hole: number) => {
    const step = HOLE_SIZE + HOLE_GAP
    return {
      locationX: (hole % HOLE_COLUMNS) * step + HOLE_SIZE / 2,
      locationY: Math.floor(hole / HOLE_COLUMNS) * step + HOLE_SIZE / 2,
    }
  }

  /**
   * 구멍마다 버튼을 두지 않고 그리드 하나가 모든 손가락을 받는다 —
   * 응답자가 전역에 하나뿐이라 버튼을 나눠 두면 두 번째 손가락이 버려진다.
   * 그래서 조작도 그리드에 좌표를 실어 보내는 방식이다.
   */
  const strikeMany = async (...holes: number[]) => {
    await act(async () => {
      fireEvent(screen.getByTestId('grid'), 'responderStart', {
        nativeEvent: { changedTouches: holes.map(pointOf) },
      })
    })
  }

  const strike = async (hole: number) => strikeMany(hole)

  return {
    onFinish,
    strike,
    strikeMany,
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
    expect(bombs).toHaveLength(bombCountFor(spawns.length))

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

/**
 * 동시 터치.
 *
 * 구멍마다 Pressable 을 두던 때는 두 마리가 같이 올라와도 한 마리만 잡혔다.
 * React Native 의 응답자는 전역에 하나뿐이라, 이미 응답자가 있으면 형제
 * 노드는 후보에서 잘려 나가고 두 번째 손가락이 통째로 버려진다.
 * 그리드 하나가 changedTouches 를 직접 훑어 이 제약을 벗어난다.
 */
describe('두 손가락', () => {
  /** 같은 순간에 올라와 있는 두 구멍을 찾는다 */
  const findTwoUp = (spawns: ReturnType<typeof buildSpawns>) => {
    for (const a of spawns) {
      const mate = spawns.find(
        (b) => b !== a && b.hole !== a.hole && b.showAtMs < a.hideAtMs && a.showAtMs < b.hideAtMs,
      )
      if (mate) return { at: Math.max(a.showAtMs, mate.showAtMs), holes: [a.hole, mate.hole] }
    }
    return null
  }

  it('동시에 올라온 두 마리를 한 번에 잡는다', async () => {
    const seed = 7
    const spawns = buildSpawns(seed, DURATION)
    const pair = findTwoUp(spawns)
    // 웨이브당 1~2마리라 같은 시드에서 겹치는 구간이 있어야 한다
    expect(pair).not.toBeNull()

    const game = await renderGame(seed)
    await advance(pair!.at + 10)

    const before = Number(screen.getByTestId('score').props.children.split(' / ')[0])
    await game.strikeMany(pair!.holes[0], pair!.holes[1])
    const after = Number(screen.getByTestId('score').props.children.split(' / ')[0])

    // 예전 구조에서는 1만 올랐다.
    expect(after - before).toBe(2)
  })

  it('여백을 같이 눌러도 구멍만 센다', async () => {
    const seed = 7
    const spawns = buildSpawns(seed, DURATION)
    const pair = findTwoUp(spawns)!
    const game = await renderGame(seed)
    await advance(pair.at + 10)

    const before = Number(screen.getByTestId('score').props.children.split(' / ')[0])
    await act(async () => {
      fireEvent(screen.getByTestId('grid'), 'responderStart', {
        nativeEvent: {
          changedTouches: [
            // 구멍 사이 여백 — 아무 것도 아니어야 한다
            { locationX: HOLE_SIZE + HOLE_GAP / 2, locationY: HOLE_SIZE / 2 },
            {
              locationX: (pair.holes[0] % HOLE_COLUMNS) * (HOLE_SIZE + HOLE_GAP) + HOLE_SIZE / 2,
              locationY:
                Math.floor(pair.holes[0] / HOLE_COLUMNS) * (HOLE_SIZE + HOLE_GAP) + HOLE_SIZE / 2,
            },
          ],
        },
      })
    })
    const after = Number(screen.getByTestId('score').props.children.split(' / ')[0])

    expect(after - before).toBe(1)
  })
})
