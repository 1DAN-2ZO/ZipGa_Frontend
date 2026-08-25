import { act, fireEvent, render, screen } from '@testing-library/react-native'
import React from 'react'
import GameCheckHarness from '../GameCheckHarness'
import { pickGames } from '../../games/registry'
import { buildSequence } from '../../games/sentenceCopy/logic'
import { SENTENCES } from '../../games/sentenceCopy/sentences'

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

const gameFor = (seed: number) => pickGames(seed, 1)[0]

/**
 * 그 게임이 뽑히는 시드를 찾아 쓴다.
 *
 * 결과 화면을 검사하려면 "아무것도 안 하면 0점"인 게임이 필요한데, 시드를 박아두면
 * 레지스트리에 게임이 하나 늘 때마다 추첨 결과가 바뀌어 애먼 테스트가 깨진다.
 */
const seedPicking = (gameId: string) => {
  for (let seed = 1; seed < 10_000; seed++) {
    if (gameFor(seed).info.id === gameId) return seed
  }
  throw new Error(`${gameId}를 뽑는 시드를 찾지 못했습니다`)
}

const SENTENCE_SEED = seedPicking('sentenceCopy')

const startWithSeed = async (seed: string) => {
  await act(async () => {
    fireEvent.changeText(screen.getByTestId('seed-input'), seed)
  })
  await act(async () => {
    fireEvent.press(screen.getByText('시작'))
  })
}

const playOutRound = async (seed: number) => {
  await act(async () => {
    jest.advanceTimersByTime(gameFor(seed).info.timeLimitSec * 1000)
  })
}

describe('GameCheckHarness', () => {
  test('시작 전에는 시드를 입력할 수 있다', async () => {
    await render(<GameCheckHarness />)
    expect(screen.getByTestId('seed-input')).toBeTruthy()
  })

  test('시드는 항상 6자리다', async () => {
    await render(<GameCheckHarness />)
    expect(screen.getByTestId('seed-input').props.value).toMatch(/^\d{6}$/)
  })

  test('새로 뽑아도 6자리다', async () => {
    await render(<GameCheckHarness />)

    await act(async () => {
      fireEvent.press(screen.getByText('시드 새로 뽑기'))
    })

    expect(screen.getByTestId('seed-input').props.value).toMatch(/^\d{6}$/)
  })

  test('시드 입력은 6자리를 넘길 수 없다', async () => {
    await render(<GameCheckHarness />)
    expect(screen.getByTestId('seed-input').props.maxLength).toBe(6)
  })

  test('입력한 시드로 시작하면 그 시드의 첫 문장이 나온다', async () => {
    await render(<GameCheckHarness />)

    await startWithSeed(String(SENTENCE_SEED))

    expect(screen.getByText(buildSequence(SENTENCE_SEED, SENTENCES)[0])).toBeTruthy()
  })

  test('게임을 레지스트리에서 고른다 — 제한시간도 GameInfo를 따른다', async () => {
    // 고정 시드를 쓰면 레지스트리에 게임이 늘 때마다 추첨 결과가 바뀌어 깨진다.
    // time-left testID를 쓰는 게임이 뽑히도록 SENTENCE_SEED를 그대로 재사용한다.
    await render(<GameCheckHarness />)

    await startWithSeed(String(SENTENCE_SEED))
    expect(screen.getByTestId('time-left').props.children.toString()).toBe(
      String(gameFor(SENTENCE_SEED).info.timeLimitSec),
    )
  })

  test('게임이 끝나면 맞춘 개수를 결과로 보여준다', async () => {
    await render(<GameCheckHarness />)
    await startWithSeed(String(SENTENCE_SEED))

    await playOutRound(SENTENCE_SEED)

    expect(screen.getByTestId('result-count').props.children.toString()).toBe('0')
  })

  test('정규화 점수가 기준선 미만이면 집에 간다고 표시한다', async () => {
    await render(<GameCheckHarness />)
    await startWithSeed(String(SENTENCE_SEED))

    await playOutRound(SENTENCE_SEED)

    expect(screen.getByTestId('result-verdict').props.children).toBe('집 가')
  })

  test('결과 화면에서 다시 시작할 수 있다', async () => {
    await render(<GameCheckHarness />)
    await startWithSeed(String(SENTENCE_SEED))
    await playOutRound(SENTENCE_SEED)

    await act(async () => {
      fireEvent.press(screen.getByText('다시하기'))
    })

    expect(screen.getByTestId('seed-input')).toBeTruthy()
  })
})
