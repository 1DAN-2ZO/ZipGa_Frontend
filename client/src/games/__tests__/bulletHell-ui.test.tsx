import { act, fireEvent, render, screen, within } from '@testing-library/react-native'
import React from 'react'
import { StyleSheet } from 'react-native'
import { bulletHell } from '../bulletHell'

const Game = bulletHell.Component
const TIME_LIMIT = bulletHell.info.timeLimitSec
const ARENA = { width: 400, height: 700 }

const flattenStyle = (style: unknown) =>
  (StyleSheet.flatten(style as never) ?? {}) as { left: number; top: number }

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

/** 컴포넌트는 onLayout으로 화면 크기를 받기 전까지 시뮬레이션을 시작하지 않는다. */
const layout = async () => {
  await act(async () => {
    fireEvent(screen.getByTestId('arena'), 'layout', {
      nativeEvent: { layout: { ...ARENA, x: 0, y: 0 } },
    })
  })
}

const renderGame = async (seed = 7, onFinish = jest.fn()) => {
  await render(<Game seed={seed} timeLimitSec={TIME_LIMIT} onFinish={onFinish} />)
  await layout()
  return onFinish
}

const advanceBy = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

/** 손가락을 화면에 댄다. 이것만으로는 캐릭터가 움직이지 않아야 한다. */
const touchAt = async (x: number, y: number) => {
  await act(async () => {
    fireEvent(screen.getByTestId('arena'), 'responderGrant', {
      nativeEvent: { locationX: x, locationY: y },
    })
  })
}

/** 손가락을 그 지점까지 끈다. 직전 지점과의 차이만큼 캐릭터가 따라온다. */
const dragTo = async (x: number, y: number) => {
  await act(async () => {
    fireEvent(screen.getByTestId('arena'), 'responderMove', {
      nativeEvent: { locationX: x, locationY: y },
    })
  })
}

const playerAt = () => {
  const { left, top } = flattenStyle(screen.getByTestId('player').props.style)
  return { left: Number(left), top: Number(top) }
}

const bulletPositions = () =>
  screen
    .queryAllByTestId('bullet')
    .map((b) => {
      const { left, top } = flattenStyle(b.props.style)
      return `${Math.round(left)},${Math.round(top)}`
    })
    .sort()

describe('bulletHell 모듈 정보', () => {
  it('계약이 요구하는 정보를 모두 갖는다', () => {
    expect(bulletHell.info.id).toBe('bulletHell')
    expect(bulletHell.info.name).toBeTruthy()
    expect(bulletHell.info.emoji).toBeTruthy()
    expect(bulletHell.info.desc).toBeTruthy()
    expect(bulletHell.info.timeLimitSec).toBe(20)
  })
})

describe('bulletHell 화면', () => {
  it('남은 시간을 보여준다', async () => {
    await renderGame()
    expect(screen.getByTestId('time-left').props.children.toString()).toBe(String(TIME_LIMIT))
  })

  it('시간이 흐르면 남은 시간이 줄어든다', async () => {
    await renderGame()

    // 1초 시점은 아직 아무도 못 죽는다 — 죽으면 시계가 멈춰서 잴 수 없다.
    // 틱(16ms)의 배수로 맞춘다. 틱 사이에서 재면 올림 경계에 걸린다.
    await advanceBy(1_008)

    expect(screen.getByTestId('time-left').props.children.toString()).toBe(String(TIME_LIMIT - 1))
  })

  it('시작하면 총알이 화면에 나온다', async () => {
    await renderGame()

    await advanceBy(1_000)

    expect(screen.queryAllByTestId('bullet').length).toBeGreaterThan(0)
  })

  it('총알에 맞으면 제한시간 전에 끝난다', async () => {
    // 화면 한가운데는 모든 패턴이 수렴하는 지점이라 끝까지 버틸 수 없다
    const onFinish = await renderGame()

    await dragTo(ARENA.width / 2, ARENA.height / 2)
    await advanceBy(TIME_LIMIT * 1000)

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0].score).toBeLessThan(TIME_LIMIT)
  })

  it('제한시간이 지나면 어떤 경우든 끝나 있다', async () => {
    const onFinish = await renderGame()

    await advanceBy(TIME_LIMIT * 1000)

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0].finished).toBe(true)
  })

  it('맞아 죽어도 그때까지 버틴 점수를 반환한다 (0점 처리 금지)', async () => {
    const onFinish = await renderGame()

    await dragTo(ARENA.width / 2, ARENA.height / 2)
    await advanceBy(TIME_LIMIT * 1000)

    const result = onFinish.mock.calls[0][0]
    expect(result.normalizedScore).toBeGreaterThan(0)
    expect(result.score).toBeGreaterThan(0)
  })

  it('총알과 플레이어는 터치를 가로채지 않는다', async () => {
    // locationX/Y는 이벤트가 닿은 자식 View 기준이다. 총알이 터치를 받으면
    // 손가락이 총알 위를 지날 때마다 그 총알 기준 좌표가 들어와 캐릭터가 순간이동한다.
    await renderGame()
    await advanceBy(1_000)

    const bullets = screen.queryAllByTestId('bullet')
    expect(bullets.length).toBeGreaterThan(0)
    for (const bullet of bullets) {
      expect(bullet.props.pointerEvents).toBe('none')
    }
    expect(screen.getByTestId('player').props.pointerEvents).toBe('none')
  })

  it('화면을 눌러도 그 자리로 순간이동하지 않는다', async () => {
    // 누른 곳으로 튀면 총알 사이를 비집고 다니는 게 아니라 안전한 칸을 찍는 게임이 된다.
    await renderGame()
    const before = playerAt()

    await touchAt(10, 10)

    expect(playerAt()).toEqual(before)
  })

  it('끈 만큼만 따라 움직인다', async () => {
    await renderGame()
    const before = playerAt()

    await touchAt(100, 100)
    await dragTo(140, 70)

    const after = playerAt()
    expect(after.left - before.left).toBeCloseTo(40)
    expect(after.top - before.top).toBeCloseTo(-30)
  })

  it('손을 뗐다 다시 대도 그 자리에서 이어서 끈다', async () => {
    // 뗀 지점을 기억하지 못하면 다시 댈 때 캐릭터가 튄다.
    await renderGame()

    await touchAt(100, 100)
    await dragTo(150, 100)
    const afterFirst = playerAt()

    await touchAt(300, 300)
    await dragTo(320, 300)

    expect(playerAt().left - afterFirst.left).toBeCloseTo(20)
  })

  it('플레이어는 화면 밖으로 도망갈 수 없다 — 나가면 무적이 된다', async () => {
    await renderGame()

    await touchAt(100, 100)
    await dragTo(-5_000, -5_000)

    const { left, top } = playerAt()
    expect(left).toBeGreaterThanOrEqual(-ARENA.width)
    expect(top).toBeGreaterThanOrEqual(-ARENA.height)
  })

  it('끝난 뒤 시간이 더 지나도 onFinish를 다시 부르지 않는다', async () => {
    const onFinish = await renderGame()

    await dragTo(ARENA.width / 2, ARENA.height / 2)
    await advanceBy(TIME_LIMIT * 3 * 1000)

    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('여러 명이 같은 시드로 들어오면 전원이 같은 탄막을 본다', async () => {
    const playerCount = 3
    await render(
      <>
        {Array.from({ length: playerCount }, (_, i) => (
          <Game key={i} seed={4242} timeLimitSec={TIME_LIMIT} onFinish={jest.fn()} />
        ))}
      </>,
    )

    // fireEvent가 스스로 act로 감싸므로 하나씩 await 한다. 한 act에 몰면 act가 겹친다.
    // 가짜 타이머라 이 사이에 시간이 흐르지 않아 세 명의 출발 시각은 그대로 같다.
    const arenas = screen.getAllByTestId('arena')
    for (const arena of arenas) {
      await act(async () => {
        fireEvent(arena, 'layout', { nativeEvent: { layout: { ...ARENA, x: 0, y: 0 } } })
      })
    }
    // 1초 시점은 어떤 총알도 아직 중앙에 닿지 못해 누구도 죽지 않는다
    await advanceBy(1_000)

    const seenByEachPlayer = arenas.map((arena) =>
      within(arena)
        .queryAllByTestId('bullet')
        .map((b) => {
          const { left, top } = flattenStyle(b.props.style)
          return `${Math.round(left)},${Math.round(top)}`
        })
        .sort(),
    )

    expect(seenByEachPlayer[0].length).toBeGreaterThan(0)
    expect(seenByEachPlayer).toEqual(Array(playerCount).fill(seenByEachPlayer[0]))
  })

  it('화면 크기를 못 받아도 제한시간에는 반드시 끝난다', async () => {
    // 계약이 자체 종료를 요구한다. 안 끝나면 세션 전체가 이 판에서 멈춘다.
    const onFinish = jest.fn()
    await render(<Game seed={7} timeLimitSec={TIME_LIMIT} onFinish={onFinish} />)

    await advanceBy(TIME_LIMIT * 1000)

    expect(onFinish).toHaveBeenCalledTimes(1)
    // 화면을 본 적조차 없으므로 0점을 주지 않는다
    expect(onFinish.mock.calls[0][0].normalizedScore).toBe(100)
  })
})
