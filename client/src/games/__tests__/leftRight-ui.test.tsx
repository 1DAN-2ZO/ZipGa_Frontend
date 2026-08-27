import { act, fireEvent, render, screen } from '@testing-library/react-native'
import React from 'react'
import { processColor, StyleSheet } from 'react-native'
import { leftRight } from '../leftRight'
import { FUR } from '../leftRight/Cat'
import {
  CAT_QUEUE_LENGTH,
  COLOR_LABELS,
  QUEUE_VISIBLE,
  makeCats,
  RAMP_AT,
  ALL_COLORS,
  makeLineup,
  sideOf,
  WRONG_LOCK_MS,
  type Side,
} from '../leftRight/logic'

const Game = leftRight.Component
const TIME_LIMIT = leftRight.info.timeLimitSec

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

const renderGame = async (seed = 7, onFinish = jest.fn()) => {
  await render(<Game seed={seed} timeLimitSec={TIME_LIMIT} onFinish={onFinish} />)
  return onFinish
}

const advanceBy = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

const send = async (side: Side) => {
  await act(async () => {
    fireEvent.press(screen.getByTestId(`send-${side}`))
  })
}

const score = () => Number(screen.getByTestId('net-score').props.children)

const shownColor = () => screen.getByTestId('cat-color')

/**
 * 그림에 칠해진 털 색.
 *
 * react-native-svg는 fill을 그대로 두지 않고 색 객체로 정규화한다.
 * 기대값도 같은 방식으로 변환해서 비교한다.
 */
const furOf = (testID: string) => screen.getByTestId(testID).props.fill?.payload
const asFill = (color: string) => processColor(color)

/** 앞에서부터 count마리를 정답으로 흘려보낸다 */
const sendCorrectly = async (seed: number, count: number) => {
  const cats = makeCats(seed, CAT_QUEUE_LENGTH, makeLineup(seed))
  for (let i = 0; i < count; i++) {
    await send(sideOf(makeLineup(seed), cats[i]))
  }
}

describe('leftRight 모듈 정보', () => {
  it('계약이 요구하는 정보를 모두 갖는다', () => {
    expect(leftRight.info.id).toBe('leftRight')
    expect(leftRight.info.name).toBeTruthy()
    expect(leftRight.info.emoji).toBeTruthy()
    expect(leftRight.info.desc).toBeTruthy()
    expect(leftRight.info.timeLimitSec).toBeGreaterThan(0)
  })
})

describe('leftRight 화면', () => {
  it('시드가 정한 첫 고양이를 보여준다', async () => {
    const seed = 4242
    const [first] = makeCats(seed, CAT_QUEUE_LENGTH, makeLineup(seed))
    await renderGame(seed)

    expect(shownColor()).toHaveTextContent(COLOR_LABELS[first])
  })

  it('고양이를 그 색으로 칠한다', async () => {
    // 색이 유일한 단서인 게임이다. 그림이 색과 따로 놀면 라벨을 읽는 게임이 된다.
    const seed = 4242
    const [first] = makeCats(seed, CAT_QUEUE_LENGTH, makeLineup(seed))
    await renderGame(seed)

    expect(furOf('queue-fur-0')).toBe(asFill(FUR[first]))
  })

  it('문지기도 자기 색으로 칠한다', async () => {
    // 어느 색이 어느 쪽에 서는지는 판마다 다르다. 배치에서 가져와 확인한다.
    const seed = 7
    const [easyA, easyB] = makeLineup(seed).easy
    await renderGame(seed)

    expect(furOf(`gate-${easyA}-fur`)).toBe(asFill(FUR[easyA]))
    expect(furOf(`gate-${easyB}-fur`)).toBe(asFill(FUR[easyB]))
  })

  it('다음에 올 고양이들을 미리 보여준다', async () => {
    // 뒤에 뭐가 오는지 보여야 손이 미리 준비된다. 한 마리씩만 보이면 반응속도 대결이 된다.
    const seed = 4242
    const cats = makeCats(seed, CAT_QUEUE_LENGTH, makeLineup(seed))
    await renderGame(seed)

    expect(screen.getAllByTestId(/^queue-fur-/)).toHaveLength(QUEUE_VISIBLE)
    for (let i = 0; i < QUEUE_VISIBLE; i++) {
      expect(furOf(`queue-fur-${i}`)).toBe(asFill(FUR[cats[i]]))
    }
  })

  it('한 마리 보내면 대기줄이 한 칸 당겨진다', async () => {
    const seed = 4242
    const cats = makeCats(seed, CAT_QUEUE_LENGTH, makeLineup(seed))
    await renderGame(seed)

    await send(sideOf(makeLineup(seed), cats[0]))

    expect(furOf('queue-fur-0')).toBe(asFill(FUR[cats[1]]))
    expect(furOf('queue-fur-1')).toBe(asFill(FUR[cats[2]]))
  })

  it('맨 앞 고양이가 뒤보다 크다', async () => {
    // 지금 보낼 놈이 한눈에 커야 어디를 보고 판단할지 헷갈리지 않는다.
    await renderGame()

    const widthOf = (depth: number) =>
      Number(StyleSheet.flatten(screen.getByTestId(`queue-slot-${depth}`).props.style).width)

    expect(widthOf(0)).toBeGreaterThan(widthOf(QUEUE_VISIBLE - 1))
  })

  it('남은 시간을 막대로도 보여준다', async () => {
    // 숫자만 있으면 급한지 아닌지가 한눈에 안 들어온다.
    const filledRatio = () => {
      const width = StyleSheet.flatten(screen.getByTestId('timer-fill').props.style).width
      return parseFloat(String(width)) / 100
    }

    await renderGame()
    expect(filledRatio()).toBe(1)

    await advanceBy(TIME_LIMIT * 500)

    expect(filledRatio()).toBeCloseTo(0.5, 1)
  })

  it('초반에는 쉬운 두 색 문지기만 세운다', async () => {
    const seed = 7
    const lineup = makeLineup(seed)
    await renderGame(seed)

    for (const color of lineup.easy) {
      expect(screen.getByTestId(`gate-${color}`)).toBeTruthy()
    }
    // 나머지 두 색은 아직 안 나온다
    for (const color of ALL_COLORS.filter((c) => !lineup.easy.includes(c))) {
      expect(screen.queryByTestId(`gate-${color}`)).toBeNull()
    }
  })

  it('색이 늘어나면 문지기 넷을 모두 세운다', async () => {
    const seed = 11
    await renderGame(seed)

    await sendCorrectly(seed, RAMP_AT)

    expect(screen.getByTestId('gate-red')).toBeTruthy()
    expect(screen.getByTestId('gate-blue')).toBeTruthy()
  })

  it('알맞은 쪽으로 보내면 점수가 1 오른다', async () => {
    const seed = 11
    const [first] = makeCats(seed, CAT_QUEUE_LENGTH, makeLineup(seed))
    await renderGame(seed)
    expect(score()).toBe(0)

    await send(sideOf(makeLineup(seed), first))

    expect(score()).toBe(1)
  })

  it('보내고 나면 다음 고양이가 나온다', async () => {
    const seed = 11
    const [first, second] = makeCats(seed, CAT_QUEUE_LENGTH, makeLineup(seed))
    await renderGame(seed)

    await send(sideOf(makeLineup(seed), first))

    expect(shownColor()).toHaveTextContent(COLOR_LABELS[second])
  })

  it('틀린 쪽으로 보내면 점수가 1 깎인다', async () => {
    const seed = 11
    const [first] = makeCats(seed, CAT_QUEUE_LENGTH, makeLineup(seed))
    await renderGame(seed)

    await send(sideOf(makeLineup(seed), first) === 'left' ? 'right' : 'left')

    expect(score()).toBe(-1)
  })

  it('점수는 0 밑으로도 내려간다', async () => {
    // 찍어서 반타작하는 게 이득이 되지 않으려면 마이너스가 실제로 쌓여야 한다.
    const seed = 11
    const cats = makeCats(seed, CAT_QUEUE_LENGTH, makeLineup(seed))
    await renderGame(seed)

    for (let i = 0; i < 3; i++) {
      await send(sideOf(makeLineup(seed), cats[i]) === 'left' ? 'right' : 'left')
      await advanceBy(WRONG_LOCK_MS)
    }

    expect(score()).toBe(-3)
  })

  it('마이너스로 끝나도 정규화 점수는 0으로 막는다', async () => {
    const seed = 11
    const cats = makeCats(seed, CAT_QUEUE_LENGTH, makeLineup(seed))
    const onFinish = await renderGame(seed)

    await send(sideOf(makeLineup(seed), cats[0]) === 'left' ? 'right' : 'left')
    await advanceBy(TIME_LIMIT * 1000)

    const result = onFinish.mock.calls[0][0]
    expect(result.score).toBe(-1)
    expect(result.normalizedScore).toBe(0)
  })

  it('틀려도 그 고양이는 넘어가고 다음 고양이가 나온다', async () => {
    const seed = 11
    const [first, second] = makeCats(seed, CAT_QUEUE_LENGTH, makeLineup(seed))
    await renderGame(seed)

    await send(sideOf(makeLineup(seed), first) === 'left' ? 'right' : 'left')

    expect(shownColor()).toHaveTextContent(COLOR_LABELS[second])
  })

  it('틀리면 잠깐 멈춰서 좌우를 마구 두드릴 수 없다', async () => {
    const seed = 11
    const cats = makeCats(seed, CAT_QUEUE_LENGTH, makeLineup(seed))
    await renderGame(seed)

    await send(sideOf(makeLineup(seed), cats[0]) === 'left' ? 'right' : 'left')
    await send(sideOf(makeLineup(seed), cats[1])) // 잠긴 동안이라 무시된다

    expect(score()).toBe(-1)
  })

  it('잠금이 풀리면 다시 보낼 수 있다', async () => {
    const seed = 11
    const cats = makeCats(seed, CAT_QUEUE_LENGTH, makeLineup(seed))
    await renderGame(seed)

    await send(sideOf(makeLineup(seed), cats[0]) === 'left' ? 'right' : 'left')
    await advanceBy(WRONG_LOCK_MS)
    await send(sideOf(makeLineup(seed), cats[1]))

    expect(score()).toBe(0) // -1 에서 +1
  })

  it('제한시간이 지나면 스스로 끝난다', async () => {
    const onFinish = await renderGame()
    expect(onFinish).not.toHaveBeenCalled()

    await advanceBy(TIME_LIMIT * 1000)

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0].finished).toBe(true)
  })

  it('시간이 끝나도 그때까지 맞힌 수를 반환한다 (0점 처리 금지)', async () => {
    const seed = 11
    const onFinish = await renderGame(seed)

    await sendCorrectly(seed, 3)
    await advanceBy(TIME_LIMIT * 1000)

    const result = onFinish.mock.calls[0][0]
    expect(result.score).toBe(3)
    expect(result.normalizedScore).toBeGreaterThan(0)
  })

  it('끝난 뒤에 눌러도 맞힌 수가 오르지 않는다', async () => {
    const seed = 11
    const [first] = makeCats(seed, CAT_QUEUE_LENGTH, makeLineup(seed))
    await renderGame(seed)

    await advanceBy(TIME_LIMIT * 1000)
    await send(sideOf(makeLineup(seed), first))

    expect(score()).toBe(0)
  })

  it('남은 시간을 초 단위로 보여준다', async () => {
    await renderGame()
    expect(screen.getByTestId('time-left')).toHaveTextContent(String(TIME_LIMIT))

    await advanceBy(5_000)

    expect(screen.getByTestId('time-left')).toHaveTextContent('15')
  })

  it('여러 명이 같은 시드로 들어오면 전원이 같은 고양이를 받는다', async () => {
    const seed = 555
    const playerCount = 3
    const [first] = makeCats(seed, CAT_QUEUE_LENGTH, makeLineup(seed))
    await render(
      <>
        {Array.from({ length: playerCount }, (_, i) => (
          <Game key={i} seed={seed} timeLimitSec={TIME_LIMIT} onFinish={jest.fn()} />
        ))}
      </>,
    )

    const shown = screen.getAllByTestId('cat-color')
    expect(shown).toHaveLength(playerCount)
    for (const node of shown) {
      expect(node).toHaveTextContent(COLOR_LABELS[first])
    }
  })
})
