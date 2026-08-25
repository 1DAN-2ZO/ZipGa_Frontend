import { act, fireEvent, render, screen } from '@testing-library/react-native'
import React from 'react'
import { whackAMole } from '../whackAMole'
import { buildMoles, HOLE_COUNT, MOLE_COUNT, normalize } from '../whackAMole/logic'

const Game = whackAMole.Component
const LIMIT = whackAMole.info.timeLimitSec
const DURATION = LIMIT * 1000
/** 제한시간을 확실히 넘기는 값. */
const PAST_END = DURATION + 200

beforeEach(() => jest.useFakeTimers())
afterEach(() => {
  jest.useRealTimers()
})

/**
 * 타이머를 ms만큼 진행시킨다.
 *
 * React 19 + RNTL 14에서는 비동기 act를 await해야 한다. 동기 act로 감싸면
 * 인터벌 틱이 겹쳐 act 중첩 경고가 나고 상태가 반영되지 않는다.
 */
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
   * RNTL 14의 fireEvent는 비동기다. await하지 않으면 act 스코프가 다음
   * 테스트로 새어 나가 그쪽 렌더를 통째로 날려버린다.
   */
  const whack = async (hole: number) => {
    await act(async () => {
      fireEvent.press(screen.getByTestId(`hole-${hole}`))
    })
  }
  const result = () => onFinish.mock.calls[0]?.[0]
  return { onFinish, whack, result, moles: buildMoles(seed, DURATION) }
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

  it('한 마리도 못 잡으면 0점이다', async () => {
    const { result } = await renderGame()
    await advance(PAST_END)

    expect(result()).toMatchObject({ score: 0, normalizedScore: 0 })
  })

  it('두더지를 잡으면 점수가 오른다', async () => {
    const { moles, whack, result } = await renderGame()
    const first = moles[0]
    const mid = Math.floor((first.showAtMs + first.hideAtMs) / 2)

    await advance(mid)
    await whack(first.hole)
    await advance(PAST_END - mid)

    expect(result()).toMatchObject({ score: 1, normalizedScore: normalize(1) })
  })

  it('같은 두더지를 두 번 쳐도 한 번만 센다', async () => {
    const { moles, whack, result } = await renderGame()
    const first = moles[0]
    const mid = Math.floor((first.showAtMs + first.hideAtMs) / 2)

    await advance(mid)
    await whack(first.hole)
    await whack(first.hole)
    await advance(PAST_END - mid)

    expect(result().score).toBe(1)
  })

  it('빈 구멍을 쳐도 점수가 깎이지 않는다', async () => {
    const { moles, whack, result } = await renderGame()
    const first = moles[0]
    const mid = Math.floor((first.showAtMs + first.hideAtMs) / 2)

    await advance(mid)

    // 그 시각에 열려 있지 않은 구멍을 골라 헛스윙한다
    const open = new Set(
      moles.filter((m) => m.showAtMs <= mid && mid < m.hideAtMs).map((m) => m.hole),
    )
    const empty = Array.from({ length: HOLE_COUNT }, (_, h) => h).find((h) => !open.has(h))
    expect(empty).toBeDefined()

    await whack(empty as number)
    await whack(first.hole)
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
    expect(r.score).toBeLessThanOrEqual(MOLE_COUNT)
  })
})
