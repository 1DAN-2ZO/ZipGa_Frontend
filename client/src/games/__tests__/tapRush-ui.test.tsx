import { act, fireEvent, render, screen } from '@testing-library/react-native'
import React from 'react'
import { tapRush } from '../tapRush'
import { normalize, TARGET_TAPS } from '../tapRush/logic'

const Game = tapRush.Component
const LIMIT = tapRush.info.timeLimitSec
const DURATION = LIMIT * 1000
const PAST_END = DURATION + 200

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

/** RNTL 14의 render는 비동기다. await하지 않으면 쿼리도 마운트도 얻지 못한다. */
async function renderGame() {
  const onFinish = jest.fn()
  await render(<Game seed={7} timeLimitSec={LIMIT} onFinish={onFinish} />)

  /**
   * RNTL 14의 fireEvent도 비동기다. await하지 않으면 act 스코프가 다음
   * 테스트로 새어 나가 그쪽 렌더를 통째로 날려버린다.
   */
  const tap = async (times = 1) => {
    await act(async () => {
      for (let i = 0; i < times; i++) {
        fireEvent.press(screen.getByTestId('tap-area'))
      }
    })
  }

  return { onFinish, tap, result: () => onFinish.mock.calls[0]?.[0] }
}

describe('tapRush 모듈 정보', () => {
  it('계약이 요구하는 정보를 모두 갖는다', () => {
    expect(tapRush.info.id).toBe('tapRush')
    expect(tapRush.info.name).toBeTruthy()
    expect(tapRush.info.emoji).toBeTruthy()
    expect(tapRush.info.desc).toBeTruthy()
    expect(tapRush.info.timeLimitSec).toBeGreaterThan(0)
  })
})

describe('tapRush 화면', () => {
  it('타수를 0부터 보여준다', async () => {
    await renderGame()
    expect(screen.getByTestId('taps')).toBeTruthy()
  })

  it('두드릴 때마다 타수가 오른다', async () => {
    const { tap } = await renderGame()
    await tap(5)
    expect(screen.getByTestId('taps').props.children).toBe(5)
  })

  it('제한시간이 지나면 스스로 종료한다', async () => {
    const { onFinish, result } = await renderGame()
    await advance(PAST_END)

    expect(onFinish).toHaveBeenCalledTimes(1)
    // 목표를 못 채웠어도 시간을 정상적으로 소진했으므로 정상 종료다.
    expect(result()).toMatchObject({ finished: true })
  })

  it('한 번도 안 누르면 0점이다', async () => {
    const { result } = await renderGame()
    await advance(PAST_END)

    expect(result()).toMatchObject({ score: 0, normalizedScore: 0 })
  })

  it('시간이 끝나면 그때까지의 타수를 반환한다', async () => {
    const { tap, result } = await renderGame()
    await tap(30)
    await advance(PAST_END)

    expect(result()).toMatchObject({ score: 30, normalizedScore: normalize(30) })
  })

  it('목표를 채우면 시간이 남아도 즉시 끝난다', async () => {
    const { onFinish, tap, result } = await renderGame()

    await advance(3_000)
    await tap(TARGET_TAPS)

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(result()).toMatchObject({
      finished: true,
      score: TARGET_TAPS,
      normalizedScore: 100,
    })
    // 20초를 다 쓰지 않았으므로 tiebreakMs가 제한시간보다 작다.
    // 이 덕분에 만점자끼리도 누가 먼저 채웠는지로 순위가 갈린다.
    expect(result().tiebreakMs).toBeLessThan(DURATION)
  })

  it('목표를 채운 뒤 더 두드려도 점수가 안 오른다', async () => {
    const { tap, result } = await renderGame()
    await tap(TARGET_TAPS + 20)

    expect(result().score).toBe(TARGET_TAPS)
  })

  it('종료 후 시간이 더 흘러도 onFinish를 다시 부르지 않는다', async () => {
    const { onFinish } = await renderGame()

    await advance(PAST_END)
    await advance(10_000)

    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('반환값이 계약 범위 안이다', async () => {
    const { tap, result } = await renderGame()
    await tap(40)
    await advance(PAST_END)

    const r = result()
    expect(r.normalizedScore).toBeGreaterThanOrEqual(0)
    expect(r.normalizedScore).toBeLessThanOrEqual(100)
    expect(r.tiebreakMs).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeGreaterThanOrEqual(0)
  })
})
