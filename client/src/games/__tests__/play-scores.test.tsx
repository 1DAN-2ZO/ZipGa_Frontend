import { act, fireEvent, render, screen } from '@testing-library/react-native'
import React from 'react'
import { gugudan } from '../gugudan'
import { makeQuestions as gugudanQuestions } from '../gugudan/logic'
import { plusminus } from '../plusminus'
import { rulercatch } from '../rulercatch'
import {
  COUNTDOWN_MS as RULER_COUNTDOWN,
  makeWaits,
  ROUNDS as RULER_ROUNDS,
} from '../rulercatch/logic'
import { makeQuestions as plusminusQuestions } from '../plusminus/logic'
import type { GameResult } from '../types'

/**
 * 잘 풀면 점수가 실제로 오르는지 본다.
 *
 * 나머지 게임은 각자 UI 테스트에서 이걸 검사하는데 이 둘만 비어 있었다.
 * "제한시간이 끝나면 onFinish를 부른다"만 통과해도 점수가 늘 0이면
 * 세션에서는 무조건 벌칙이다 — 끝나는 것과 점수가 나오는 것은 다른 문제다.
 */

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

const advance = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms)
  })
}

const type = async (text: string) => {
  await act(async () => {
    fireEvent.changeText(screen.getByTestId('answer'), text)
  })
}

describe('plusminus 실제 플레이', () => {
  const SEED = 4242

  it('정답을 연달아 치면 점수가 오른다', async () => {
    const onFinish = jest.fn()
    await render(
      <plusminus.Component
        seed={SEED}
        timeLimitSec={plusminus.info.timeLimitSec}
        onFinish={onFinish}
      />,
    )

    const questions = plusminusQuestions(SEED)
    const SOLVED = 5
    for (let i = 0; i < SOLVED; i++) {
      await type(String(questions[i].answer))
    }

    // 남은 시간을 태워 끝낸다
    await advance(plusminus.info.timeLimitSec * 1000)

    const result = onFinish.mock.calls[0][0] as GameResult
    expect(result.score).toBe(SOLVED)
    expect(result.normalizedScore).toBeGreaterThan(0)
  })

  it('한 문제도 못 풀면 0점이다', async () => {
    const onFinish = jest.fn()
    await render(
      <plusminus.Component
        seed={SEED}
        timeLimitSec={plusminus.info.timeLimitSec}
        onFinish={onFinish}
      />,
    )

    await advance(plusminus.info.timeLimitSec * 1000)

    const result = onFinish.mock.calls[0][0] as GameResult
    expect(result.score).toBe(0)
    expect(result.normalizedScore).toBe(0)
  })
})

describe('gugudan 실제 플레이', () => {
  const SEED = 4242

  it('정답을 연달아 치면 점수가 오른다', async () => {
    const onFinish = jest.fn()
    await render(
      <gugudan.Component
        seed={SEED}
        timeLimitSec={gugudan.info.timeLimitSec}
        onFinish={onFinish}
      />,
    )

    const questions = gugudanQuestions(SEED)
    const SOLVED = 5
    for (let i = 0; i < SOLVED; i++) {
      await type(String(questions[i].answer))
    }

    await advance(gugudan.info.timeLimitSec * 1000)

    const result = onFinish.mock.calls[0][0] as GameResult
    expect(result.score).toBe(SOLVED)
    expect(result.normalizedScore).toBeGreaterThan(0)
  })

  it('한 문제도 못 풀면 0점이다', async () => {
    const onFinish = jest.fn()
    await render(
      <gugudan.Component
        seed={SEED}
        timeLimitSec={gugudan.info.timeLimitSec}
        onFinish={onFinish}
      />,
    )

    await advance(gugudan.info.timeLimitSec * 1000)

    const result = onFinish.mock.calls[0][0] as GameResult
    expect(result.score).toBe(0)
    expect(result.normalizedScore).toBe(0)
  })
})

describe('rulercatch 실제 플레이', () => {
  const SEED = 4242

  // 무대 높이를 받기 전에는 라운드가 시작되지 않는다.
  const STAGE = { x: 0, y: 200, width: 340, height: 420 }

  const layoutStage = async () => {
    await act(async () => {
      fireEvent(screen.getByTestId('stage'), 'layout', { nativeEvent: { layout: STAGE } })
    })
  }

  /**
   * 이제는 아무 데나 눌러서는 안 잡힌다 — 떨어지는 자를 덮어야 한다.
   * 자는 무대 가운데(폭 RULER_W)에 있고, 판정은 무대 기준 좌표로 한다.
   * 화면 전체가 Pressable이라 locationY에서 무대 top(STAGE.y)을 빼서 본다.
   */
  const tapRuler = async () => {
    await act(async () => {
      fireEvent(screen.getByTestId('game-root'), 'pressIn', {
        nativeEvent: {
          locationX: STAGE.width / 2,   // 자의 가운데
          locationY: STAGE.y + 1,       // 막 나오기 시작한 자의 끝
        },
      })
    })
  }

  it('자가 나올 때 잡으면 점수가 나온다', async () => {
    const onFinish = jest.fn()
    await render(
      <rulercatch.Component
        seed={SEED}
        timeLimitSec={rulercatch.info.timeLimitSec}
        onFinish={onFinish}
      />,
    )
    await layoutStage()

    const waits = makeWaits(SEED)
    for (let i = 0; i < RULER_ROUNDS; i++) {
      // count(3초) → armed(waits[i]) → emerging. emerging에서 잡아야 한다.
      // 자가 조금이라도 나온 뒤여야 판정이 선다(나온 길이가 0이면 안 잡힌다).
      await advance(RULER_COUNTDOWN + waits[i] + 120)
      await tapRuler()
    }

    await advance(rulercatch.info.timeLimitSec * 1000)

    const result = onFinish.mock.calls[0][0] as GameResult
    // 빨리 잡을수록 낮은 cm = 높은 점수
    expect(result.normalizedScore).toBeGreaterThan(0)
  })

  it('가만히 있으면 점수가 낮다', async () => {
    const onFinish = jest.fn()
    await render(
      <rulercatch.Component
        seed={SEED}
        timeLimitSec={rulercatch.info.timeLimitSec}
        onFinish={onFinish}
      />,
    )
    await layoutStage()

    await advance(rulercatch.info.timeLimitSec * 1000)

    const idle = onFinish.mock.calls[0][0] as GameResult
    expect(idle.normalizedScore).toBeLessThan(100)
  })
})
