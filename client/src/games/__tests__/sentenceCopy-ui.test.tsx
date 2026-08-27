import { act, fireEvent, render, screen } from '@testing-library/react-native'
import React from 'react'
import { Keyboard, StyleSheet } from 'react-native'
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

/**
 * 폰에서 키보드가 올라오면 화면 높이가 절반 가까이 줄어든다.
 * 예전에는 stage가 justifyContent:'center'인 View라 문장이 위아래로 넘쳐
 * 윗줄이 잘려 나갔다 — 따라 쓸 문장을 읽을 수 없으니 게임이 성립하지 않는다.
 */
describe('키보드가 올라왔을 때', () => {
  // RN의 Keyboard에는 테스트에서 이벤트를 쏘는 공개 수단이 없다.
  // addListener를 가로채 콜백을 붙잡아 뒀다가 직접 부른다.
  let listeners: Record<string, Array<() => void>> = {}

  beforeEach(() => {
    listeners = {}
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: () => void) => {
      ;(listeners[event] ??= []).push(cb)
      return { remove: () => {} }
    }) as unknown as typeof Keyboard.addListener)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  const fire = async (event: string) => {
    await act(async () => {
      listeners[event]?.forEach((cb) => cb())
    })
  }
  const showKeyboard = () => fire('keyboardDidShow')
  const hideKeyboard = () => fire('keyboardDidHide')

  it('예시 문장은 그대로 남는다', async () => {
    const seed = 20260826
    await renderGame(seed)
    const [first] = sequenceFor(seed)

    await showKeyboard()

    expect(screen.getByTestId('current-sentence')).toHaveTextContent(first)
  })

  it('자리를 벌기 위해 주변 요소를 접는다', async () => {
    await renderGame(20260826)

    // 키보드가 없을 때는 라벨과 안내가 다 보인다
    expect(screen.queryByText('이 문장을 똑같이')).not.toBeNull()
    expect(screen.queryByText('맞춘 개수')).not.toBeNull()
    expect(screen.queryByText('띄어쓰기·문장부호까지 똑같이')).not.toBeNull()

    await showKeyboard()

    // 문장에 자리를 내주기 위해 접힌다
    expect(screen.queryByText('이 문장을 똑같이')).toBeNull()
    expect(screen.queryByText('맞춘 개수')).toBeNull()
    expect(screen.queryByText('띄어쓰기·문장부호까지 똑같이')).toBeNull()

    // 점수와 남은 시간 자체는 계속 보인다
    expect(screen.queryByTestId('correct-count')).not.toBeNull()
    expect(screen.queryByTestId('time-left')).not.toBeNull()
  })

  it('틀렸다는 신호는 키보드가 올라와 있어도 남긴다', async () => {
    await renderGame(20260826)
    await showKeyboard()

    await typeAndSubmit('이건 분명히 틀린 문장이다')

    expect(screen.queryByText('다시! 한 글자도 틀리면 안 돼')).not.toBeNull()
  })

  it('키보드가 내려가면 원래대로 돌아온다', async () => {
    await renderGame(20260826)
    await showKeyboard()
    await hideKeyboard()

    expect(screen.queryByText('이 문장을 똑같이')).not.toBeNull()
    expect(screen.queryByText('맞춘 개수')).not.toBeNull()
  })
})

/**
 * 웹(react-native-web)에서는 Keyboard.addListener가 빈 스텁이라 이벤트가
 * 아예 오지 않는다. Android 네이티브도 창이 resize될 뿐이다.
 * 그래서 이벤트와 별개로 "남은 높이"만으로도 축소본이 켜져야 한다.
 */
describe('남은 높이가 좁을 때 (웹·Android)', () => {
  const layout = async (height: number) => {
    await act(async () => {
      fireEvent(screen.getByTestId('game-root'), 'layout', {
        nativeEvent: { layout: { width: 390, height } },
        // 루트가 KeyboardAvoidingView라 내부에서 event.persist()를 부른다.
        // 실제 RN 레이아웃 이벤트에는 있는 메서드라 여기서도 채워준다.
        persist: () => {},
      })
    })
  }

  it('키보드 이벤트 없이 높이만으로 축소본이 켜진다', async () => {
    const seed = 20260826
    await renderGame(seed)
    const [first] = sequenceFor(seed)

    // 키보드가 올라온 폰에 남는 높이
    await layout(400)

    expect(screen.queryByText('이 문장을 똑같이')).toBeNull()
    expect(screen.queryByText('맞춘 개수')).toBeNull()
    // 정작 중요한 문장은 그대로 남는다
    expect(screen.getByTestId('current-sentence')).toHaveTextContent(first)
  })

  it('키보드가 없는 온전한 높이에서는 축소하지 않는다', async () => {
    await renderGame(20260826)

    await layout(844)

    expect(screen.queryByText('이 문장을 똑같이')).not.toBeNull()
    expect(screen.queryByText('맞춘 개수')).not.toBeNull()
  })
})

/**
 * iOS는 키보드가 화면을 덮기만 하고 창을 줄이지 않는다. 그대로 두면
 * 입력창이 키보드 뒤로 숨어서 아무것도 칠 수 없다.
 * Android는 창 자체가 resize되므로 여기서 또 밀면 두 번 밀린다.
 */
describe('iOS 키보드 회피', () => {
  // behavior='padding'이 실제로 화면을 밀어 올리는지는 시뮬레이터/실기기에서만
  // 확인할 수 있다. KeyboardAvoidingView는 behavior를 호스트 View로 넘기지 않고,
  // RNTL v14에는 컴포지트 요소를 조회하는 수단이 없다.

  it('배경색은 공통 톤 그대로다', async () => {
    // 루트를 KeyboardAvoidingView로 바꿔도 games/__tests__/theme.test.tsx의
    // 검사 대상은 그대로여야 한다.
    await renderGame(20260826)

    const root = screen.getByTestId('game-root')
    expect(StyleSheet.flatten(root.props.style).backgroundColor).toBe('#E9E9ED')
  })
})

/**
 * 예시 문장과 입력칸 사이가 벌어지고, 키보드가 올라오면 문장 윗줄이
 * 잘리던 문제.
 *
 * 원인이 둘이었다.
 *  1. 문장 영역(ScrollView)이 남는 공간만큼 자라서 그만큼 아래가 비었다.
 *     ScrollView 기본값이 flex:1 1 auto 라 가만두면 커진다.
 *  2. 그 안의 내용을 justifyContent:'center'로 가운데 정렬했는데, 내용이
 *     넘칠 때 가운데 정렬은 윗부분을 위로 밀어낸다. 그 영역은 스크롤로도
 *     닿지 못해서 첫 줄이 영영 안 보였다.
 */
describe('문장과 입력칸 배치', () => {
  const stage = () => screen.getByTestId('sentence-stage')

  it('문장 영역이 남는 공간만큼 자라지 않는다', async () => {
    await renderGame(20260827)

    // 자라면 그만큼 문장과 입력칸 사이가 벌어진다.
    // ScrollView 기본값(flex:1 1 auto)을 덮어써야 해서 0을 못박는다.
    const style = StyleSheet.flatten(stage().props.style)
    expect(style.flexGrow).toBe(0)
  })

  it('자리가 모자라도 문장이 통째로 사라지지는 않는다', async () => {
    await renderGame(20260827)

    // flexShrink는 0까지 줄어들 수 있다. 최소 한 줄은 남겨야 한다.
    const style = StyleSheet.flatten(stage().props.style)
    expect(style.flexShrink).toBe(1)
    expect(style.minHeight).toBeGreaterThan(0)
  })

  it('넘치는 내용을 가운데 정렬하지 않는다', async () => {
    await renderGame(20260827)

    // 가운데 정렬은 넘친 윗부분을 스크롤로도 못 닿는 곳으로 밀어낸다.
    const content = StyleSheet.flatten(stage().props.contentContainerStyle)
    expect(content?.justifyContent).toBeUndefined()
  })
})
