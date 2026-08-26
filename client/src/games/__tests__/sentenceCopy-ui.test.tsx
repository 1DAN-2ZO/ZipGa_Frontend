import { act, fireEvent, render, screen } from '@testing-library/react-native'
import React from 'react'
import { sentenceCopy } from '../sentenceCopy'
import { buildSequence } from '../sentenceCopy/logic'
import { SENTENCES } from '../sentenceCopy/sentences'
import { validateGameResult } from '../types'

const SentenceCopyGame = sentenceCopy.Component
const TIME_LIMIT = sentenceCopy.info.timeLimitSec

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

/** 이 seed에서 나올 문장 순서 — 컴포넌트가 같은 시드를 쓰는지 확인하는 기준 */
const sequenceFor = (seed: number) => buildSequence(seed, SENTENCES)

const renderGame = async (seed: number, onFinish = jest.fn()) => {
  await render(<SentenceCopyGame seed={seed} timeLimitSec={TIME_LIMIT} onFinish={onFinish} />)
  return onFinish
}

/** 입력과 전송은 실제 사용에서도 별개의 커밋이므로 act를 나눈다 */
const typeAndSubmit = async (text: string) => {
  const input = screen.getByPlaceholderText('여기에 똑같이 입력')
  await act(async () => {
    fireEvent.changeText(input, text)
  })
  await act(async () => {
    fireEvent(input, 'submitEditing')
  })
}

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

const textOf = (testID: string) => screen.getByTestId(testID).props.children.toString()

describe('sentenceCopy 모듈 선언', () => {
  test('계약이 요구하는 GameInfo를 갖는다', () => {
    expect(sentenceCopy.info).toEqual({
      id: 'sentenceCopy',
      name: expect.any(String),
      emoji: expect.any(String),
      desc: expect.any(String),
      timeLimitSec: expect.any(Number),
    })
  })

  test('id가 폴더명과 같다', () => {
    expect(sentenceCopy.info.id).toBe('sentenceCopy')
  })
})

describe('SentenceCopyGame', () => {
  test('같은 seed를 받으면 같은 첫 문장을 보여준다', async () => {
    const seed = 4242
    await renderGame(seed)

    expect(screen.getByText(sequenceFor(seed)[0])).toBeTruthy()
  })

  test('여러 명이 같은 시드로 들어오면 전원이 같은 문장을 받는다', async () => {
    const seed = 555
    const playerCount = 4

    await render(
      <>
        {Array.from({ length: playerCount }, (_, i) => (
          <SentenceCopyGame key={i} seed={seed} timeLimitSec={TIME_LIMIT} onFinish={jest.fn()} />
        ))}
      </>,
    )

    const shownToEachPlayer = screen
      .getAllByTestId('current-sentence')
      .map((node) => node.props.children)
    expect(shownToEachPlayer).toEqual(Array(playerCount).fill(sequenceFor(seed)[0]))
  })

  test('문장을 똑같이 입력하면 정답 개수가 올라간다', async () => {
    const seed = 99
    await renderGame(seed)
    expect(textOf('correct-count')).toBe('0')

    await typeAndSubmit(sequenceFor(seed)[0])

    expect(textOf('correct-count')).toBe('1')
  })

  test('정답이면 다음 문장으로 넘어간다', async () => {
    const seed = 99
    const sequence = sequenceFor(seed)
    await renderGame(seed)

    await typeAndSubmit(sequence[0])

    expect(screen.getByText(sequence[1])).toBeTruthy()
  })

  test('틀리게 입력하면 개수가 오르지 않고 문장도 그대로다', async () => {
    const seed = 99
    const sequence = sequenceFor(seed)
    await renderGame(seed)

    await typeAndSubmit(sequence[0] + '오타')

    expect(textOf('correct-count')).toBe('0')
    expect(screen.getByText(sequence[0])).toBeTruthy()
  })

  test('제한시간이 지나면 onFinish를 정확히 한 번 호출한다', async () => {
    const onFinish = await renderGame(7)
    expect(onFinish).not.toHaveBeenCalled()

    await advance(TIME_LIMIT * 1000)
    await advance(5000)

    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  test('제한시간이 지나면 그때까지 맞힌 개수를 결과로 넘긴다', async () => {
    const seed = 99
    const sequence = sequenceFor(seed)
    const onFinish = await renderGame(seed)

    await typeAndSubmit(sequence[0])
    await typeAndSubmit(sequence[1])
    await advance(TIME_LIMIT * 1000)

    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ score: 2, finished: true }))
  })

  test('시간 초과로 끝나도 0점 처리하지 않는다', async () => {
    const seed = 99
    const onFinish = await renderGame(seed)

    await typeAndSubmit(sequenceFor(seed)[0])
    await advance(TIME_LIMIT * 1000)

    expect(onFinish.mock.calls[0][0].normalizedScore).toBeGreaterThan(0)
  })

  test('반환하는 결과가 계약을 위반하지 않는다', async () => {
    const seed = 99
    const onFinish = await renderGame(seed)

    await typeAndSubmit(sequenceFor(seed)[0])
    await advance(TIME_LIMIT * 1000)

    expect(validateGameResult(onFinish.mock.calls[0][0], 'sentenceCopy')).toEqual([])
  })

  test('시간이 끝나기 전에는 onFinish를 호출하지 않는다', async () => {
    const onFinish = await renderGame(7)

    await advance((TIME_LIMIT - 1) * 1000)

    expect(onFinish).not.toHaveBeenCalled()
  })

  test('시간이 끝난 뒤 다시 입력해도 개수가 오르지 않는다', async () => {
    const seed = 99
    const sequence = sequenceFor(seed)
    await renderGame(seed)

    await advance(TIME_LIMIT * 1000)
    await typeAndSubmit(sequence[0])

    expect(textOf('correct-count')).toBe('0')
  })

  test('남은 시간을 초 단위로 보여준다', async () => {
    await renderGame(7)
    expect(textOf('time-left')).toBe(String(TIME_LIMIT))

    await advance(5000)

    expect(textOf('time-left')).toBe(String(TIME_LIMIT - 5))
  })

  test('중도 이탈하면 finished가 false인 결과를 넘긴다', async () => {
    const onFinish = jest.fn()
    const view = await render(
      <SentenceCopyGame seed={99} timeLimitSec={TIME_LIMIT} onFinish={onFinish} />,
    )

    await act(async () => {
      view.unmount()
    })

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0].finished).toBe(false)
  })
})

/**
 * 한 판에 여러 문장을 연속으로 친다. 제출할 때마다 키보드가 내려가면
 * 다음 문장을 칠 때마다 입력창을 다시 눌러야 해서 게임이 성립하지 않는다.
 *
 * react-native-web은 submitBehavior를 모르고 레거시 blurOnSubmit만 본다.
 * 단일행 기본값이 true라 이 속성이 빠지면 웹에서 Enter마다 blur된다.
 */
describe('제출 후 포커스 유지', () => {
  it('제출해도 입력창이 흐려지지 않게 두 속성을 모두 넘긴다', async () => {
    await renderGame(20260826)
    const input = screen.getByPlaceholderText('여기에 똑같이 입력')

    // 네이티브용
    expect(input.props.submitBehavior).toBe('submit')
    // 웹(react-native-web)용 — 없으면 단일행 기본값 true라 blur된다
    expect(input.props.blurOnSubmit).toBe(false)
  })

  it('정답을 낸 뒤에도 입력창이 계속 살아 있다', async () => {
    const seed = 20260826
    await renderGame(seed)
    const [first] = sequenceFor(seed)

    await typeAndSubmit(first)

    const input = screen.getByPlaceholderText('여기에 똑같이 입력')
    // 다음 문장으로 넘어갔고, 입력창은 여전히 칠 수 있는 상태다
    expect(input.props.editable).toBe(true)
    expect(input.props.value).toBe('')
  })
})
