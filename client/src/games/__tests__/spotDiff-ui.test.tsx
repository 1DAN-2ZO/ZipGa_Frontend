import { act, fireEvent, render, screen } from '@testing-library/react-native'
import React from 'react'
import { spotDiff } from '../spotDiff'
import { DIFF_COUNT, makeScene, WRONG_LOCK_MS, type Patch } from '../spotDiff/logic'

const Game = spotDiff.Component
const TIME_LIMIT = spotDiff.info.timeLimitSec

/** 그림 폭이 1:1로 떨어지도록 넉넉히 준다 */
const BOARD_W = 300

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

const renderGame = async (seed = 7, onFinish = jest.fn()) => {
  await render(<Game seed={seed} timeLimitSec={TIME_LIMIT} onFinish={onFinish} />)
  await act(async () => {
    fireEvent(screen.getByTestId('boards'), 'layout', {
      nativeEvent: { layout: { width: BOARD_W, height: 2000, x: 0, y: 0 } },
    })
  })
  return onFinish
}

const advanceBy = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

const boardHeight = (seed: number, index: number) => BOARD_W / makeScene(seed, index).photo.aspect

/** 그 영역 한가운데를 누른다 */
const tapPatch = async (side: 'left' | 'right', patch: Patch, seed: number, index = 0) => {
  const cx = (patch.rect.x + patch.rect.w / 2) * BOARD_W
  const cy = (patch.rect.y + patch.rect.h / 2) * boardHeight(seed, index)
  await act(async () => {
    fireEvent(screen.getByTestId(`scene-${side}`), 'responderRelease', {
      nativeEvent: { locationX: cx, locationY: cy },
    })
  })
}

const patchesOf = (seed: number, index = 0) => {
  const scene = makeScene(seed, index)
  const altered = scene.photo.patches.filter((p) => scene.patchIds.includes(p.id))
  const untouched = scene.photo.patches.filter((p) => !scene.patchIds.includes(p.id))
  return { altered, untouched }
}

const foundCount = () => Number(screen.getByTestId('found-count').props.children)

describe('spotDiff 모듈 정보', () => {
  it('계약이 요구하는 정보를 모두 갖는다', () => {
    expect(spotDiff.info.id).toBe('spotDiff')
    expect(spotDiff.info.name).toBeTruthy()
    expect(spotDiff.info.emoji).toBeTruthy()
    expect(spotDiff.info.desc).toBeTruthy()
    expect(spotDiff.info.timeLimitSec).toBeGreaterThan(0)
  })
})

describe('spotDiff 화면', () => {
  it('그림 두 장을 보여준다', async () => {
    await renderGame()
    expect(screen.getByTestId('scene-left')).toBeTruthy()
    expect(screen.getByTestId('scene-right')).toBeTruthy()
  })

  it('무슨 동물인지 밝힌다', async () => {
    const seed = 11
    const { photo } = makeScene(seed, 0)
    await renderGame(seed)
    expect(screen.getByText(photo.subject)).toBeTruthy()
  })

  it('고쳐진 곳을 누르면 찾은 개수가 올라간다', async () => {
    const seed = 11
    const { altered } = patchesOf(seed)
    await renderGame(seed)
    expect(foundCount()).toBe(0)

    await tapPatch('right', altered[0], seed)

    expect(foundCount()).toBe(1)
  })

  it('위 그림을 눌러도 똑같이 인정한다', async () => {
    const seed = 11
    const { altered } = patchesOf(seed)
    await renderGame(seed)

    await tapPatch('left', altered[0], seed)

    expect(foundCount()).toBe(1)
  })

  it('이미 찾은 곳을 다시 눌러도 개수가 늘지 않는다', async () => {
    const seed = 11
    const { altered } = patchesOf(seed)
    await renderGame(seed)

    await tapPatch('right', altered[0], seed)
    await tapPatch('right', altered[0], seed)

    expect(foundCount()).toBe(1)
  })

  it('다 찾으면 다음 문제로 넘어간다', async () => {
    const seed = 11
    const { altered } = patchesOf(seed)
    await renderGame(seed)

    for (const patch of altered) {
      await tapPatch('right', patch, seed)
    }

    expect(foundCount()).toBe(DIFF_COUNT)
    expect(screen.getByTestId('scene-index').props.children).toBe(1)
  })

  it('다 찾기 전에는 문제가 안 넘어간다', async () => {
    const seed = 11
    const { altered } = patchesOf(seed)
    await renderGame(seed)

    for (const patch of altered.slice(0, DIFF_COUNT - 1)) {
      await tapPatch('right', patch, seed)
    }

    expect(screen.getByTestId('scene-index').props.children).toBe(0)
  })

  it('안 고친 곳을 눌러도 개수가 줄지 않는다', async () => {
    const seed = 11
    const { altered, untouched } = patchesOf(seed)
    await renderGame(seed)

    await tapPatch('right', altered[0], seed)
    await tapPatch('right', untouched[0], seed)

    expect(foundCount()).toBe(1)
  })

  it('빈 곳을 눌러도 틀린 것으로 친다', async () => {
    // 사진 대부분은 고친 자리가 아니다. 빈 곳이 공짜면 마구 두드리는 게 이긴다.
    const seed = 11
    const { altered } = patchesOf(seed)
    await renderGame(seed)

    await act(async () => {
      fireEvent(screen.getByTestId('scene-right'), 'responderRelease', {
        nativeEvent: { locationX: -500, locationY: -500 },
      })
    })

    expect(foundCount()).toBe(0)
    expect(screen.getByTestId('wrong-mark')).toBeTruthy()

    // 잠겨 있으므로 바로 정답을 눌러도 안 먹는다
    await tapPatch('right', altered[0], seed)
    expect(foundCount()).toBe(0)
  })

  it('틀리면 X를 크게 띄운다', async () => {
    const seed = 11
    const { untouched } = patchesOf(seed)
    await renderGame(seed)
    expect(screen.queryByTestId('wrong-mark')).toBeNull()

    await tapPatch('right', untouched[0], seed)

    expect(screen.getByTestId('wrong-mark')).toBeTruthy()
  })

  it('1초 뒤에 X가 사라진다', async () => {
    const seed = 11
    const { untouched } = patchesOf(seed)
    await renderGame(seed)

    await tapPatch('right', untouched[0], seed)
    await advanceBy(WRONG_LOCK_MS)

    expect(screen.queryByTestId('wrong-mark')).toBeNull()
  })

  it('맞히면 X가 뜨지 않는다', async () => {
    const seed = 11
    const { altered } = patchesOf(seed)
    await renderGame(seed)

    await tapPatch('right', altered[0], seed)

    expect(screen.queryByTestId('wrong-mark')).toBeNull()
  })

  it('틀리면 잠깐 멈춰서 화면을 마구 두드릴 수 없다', async () => {
    const seed = 11
    const { altered, untouched } = patchesOf(seed)
    await renderGame(seed)

    await tapPatch('right', untouched[0], seed)
    await tapPatch('right', altered[0], seed) // 잠긴 동안이라 무시된다

    expect(foundCount()).toBe(0)
  })

  it('잠금이 풀리면 다시 누를 수 있다', async () => {
    const seed = 11
    const { altered, untouched } = patchesOf(seed)
    await renderGame(seed)

    await tapPatch('right', untouched[0], seed)
    await advanceBy(WRONG_LOCK_MS)
    await tapPatch('right', altered[0], seed)

    expect(foundCount()).toBe(1)
  })

  it('제한시간이 지나면 스스로 끝난다', async () => {
    const onFinish = await renderGame()
    expect(onFinish).not.toHaveBeenCalled()

    await advanceBy(TIME_LIMIT * 1000)

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0].finished).toBe(true)
  })

  it('시간이 끝나도 그때까지 찾은 개수를 반환한다 (0점 처리 금지)', async () => {
    const seed = 11
    const { altered } = patchesOf(seed)
    const onFinish = await renderGame(seed)

    await tapPatch('right', altered[0], seed)
    await advanceBy(TIME_LIMIT * 1000)

    const result = onFinish.mock.calls[0][0]
    expect(result.score).toBe(1)
    expect(result.normalizedScore).toBeGreaterThan(0)
  })

  it('끝난 뒤에 눌러도 개수가 오르지 않는다', async () => {
    const seed = 11
    const { altered } = patchesOf(seed)
    await renderGame(seed)

    await advanceBy(TIME_LIMIT * 1000)
    await tapPatch('right', altered[0], seed)

    expect(foundCount()).toBe(0)
  })

  it('남은 시간을 초 단위로 보여준다', async () => {
    await renderGame()
    expect(screen.getByTestId('time-left')).toHaveTextContent(String(TIME_LIMIT))

    await advanceBy(5_000)

    expect(screen.getByTestId('time-left')).toHaveTextContent('15')
  })

  it('여러 명이 같은 시드로 들어오면 전원이 같은 문제를 받는다', async () => {
    const seed = 555
    const playerCount = 3
    await render(
      <>
        {Array.from({ length: playerCount }, (_, i) => (
          <Game key={i} seed={seed} timeLimitSec={TIME_LIMIT} onFinish={jest.fn()} />
        ))}
      </>,
    )

    const states = screen.getAllByTestId('scene-state')
    expect(states).toHaveLength(playerCount)
    const expected = makeScene(seed, 0).patchIds.join(',')
    for (const state of states) {
      expect(state.props.children).toBe(expected)
    }
  })
})
