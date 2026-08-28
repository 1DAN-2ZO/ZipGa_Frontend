import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react-native'
import { Home } from '../Home'
import { SoloPlay } from '../SoloPlay'

// @expo/vector-icons는 expo-font → expo-asset을 끌고 오는데 이 프로젝트엔 expo-asset이
// 없다(앱에서는 Metro가 해결한다). 아이콘은 이 테스트의 관심사가 아니라 비워둔다.
jest.mock('@expo/vector-icons', () => ({ MaterialIcons: () => null }))

/**
 * 흐름만 보려고 레지스트리를 즉시 끝나는 가짜 게임 3종으로 갈아끼운다.
 * 미니게임 자체는 games/__tests__가 따로 맡는다.
 *
 * 혼자 하기 화면은 게임을 registry로만 찾으므로(방 세션과 같은 규칙),
 * 편성·공개·호스트가 모두 이 가짜 풀을 본다.
 */
jest.mock('../../games/registry', () => {
  const React = require('react')
  const { createRng } = require('../../games/prng')

  const make = (id: string, normalizedScore: number) => ({
    info: { id, name: `게임${id}`, emoji: '🎮', desc: `${id} 설명`, timeLimitSec: 10 },
    Component: ({ onFinish }: { onFinish: (r: unknown) => void }) => {
      React.useEffect(() => {
        onFinish({ normalizedScore, score: normalizedScore, tiebreakMs: 100, finished: true })
      }, [onFinish])
      return null
    },
  })

  // 3판 평균이 60점이 되도록 — 기준선(40) 위
  const GAMES = [make('a', 60), make('b', 60), make('c', 60)]

  return {
    GAMES,
    getGame: (id: string) => GAMES.find((g) => g.info.id === id),
    pickFrom: (pool: unknown[], seed: number, count: number) =>
      createRng(seed).shuffle(pool).slice(0, count),
    pickGames: (seed: number, count: number) => createRng(seed).shuffle(GAMES).slice(0, count),
  }
})

/** 게임 공개 연출은 카드 한 장에 800ms씩 이어진다 */
const REVEAL_STEP_MS = 800

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

async function press(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID))
  })
}

/**
 * 그 화면이 나올 때까지 시계를 돌린다.
 *
 * 공개·카운트다운·판 결과가 각자 타이머로 이어지는데 렌더 반영 시점이 한 틱씩
 * 밀려서, 단계마다 정확한 ms를 세면 쉽게 어긋난다. 여기서 확인할 것은 "혼자서도
 * 3판이 끝까지 돈다"이지 각 연출의 길이가 아니다.
 */
async function runUntil(testID: string, maxSteps = 60) {
  for (let step = 0; step < maxSteps; step += 1) {
    if (screen.queryByTestId(testID)) return
    await advance(500)
  }
  throw new Error(`${testID}가 끝내 나타나지 않았습니다.`)
}

describe('메인의 혼자하기', () => {
  it('방 만들기·방 참여하기와 나란히 버튼이 있다', async () => {
    const onSoloPlay = jest.fn()
    await render(
      <Home
        onCreateRoom={jest.fn()}
        onJoinRoom={jest.fn()}
        onSoloPlay={onSoloPlay}
        onRejoin={jest.fn()}
        onSettings={jest.fn()}
      />,
    )

    fireEvent.press(screen.getByTestId('solo-play'))
    expect(onSoloPlay).toHaveBeenCalled()
  })
})

describe('SoloPlay', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('들어가면 방장처럼 시작하기 버튼이 있다', async () => {
    await render(<SoloPlay onExit={jest.fn()} onSettings={jest.fn()} />)

    expect(screen.getByTestId('solo-start')).toBeTruthy()
  })

  it('시작하면 3판이 공개된다', async () => {
    await render(<SoloPlay onExit={jest.fn()} onSettings={jest.fn()} />)

    await press('solo-start')
    expect(screen.getByText('이번 세션의 게임')).toBeTruthy()

    // 카드가 한 장씩 열린다 — 한 장 열릴 때마다 렌더가 한 번 돌아야 다음 장이 걸린다
    await advance(REVEAL_STEP_MS)
    await advance(REVEAL_STEP_MS)
    await advance(REVEAL_STEP_MS)

    expect(screen.getAllByText(/^게임[abc]$/)).toHaveLength(3)
  })

  it('혼자서 3판을 끝까지 돌고 평균이 나온다', async () => {
    await render(<SoloPlay onExit={jest.fn()} onSettings={jest.fn()} />)

    await press('solo-start')
    await runUntil('solo-average')

    expect(screen.getByTestId('solo-average')).toHaveTextContent('60점')
    expect(screen.getByText('통과')).toBeTruthy()
  })

  it('결과에서 한 판 더를 누르면 새 3판이 시작된다', async () => {
    await render(<SoloPlay onExit={jest.fn()} onSettings={jest.fn()} />)

    await press('solo-start')
    await runUntil('solo-average')

    await press('solo-restart')

    expect(screen.getByText('이번 세션의 게임')).toBeTruthy()
  })
})
