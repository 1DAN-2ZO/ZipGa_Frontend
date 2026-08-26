import { act, render } from '@testing-library/react-native'
import React from 'react'
import { FORCE_FINISH_GRACE_MS } from '../../screens/GameHost'
import { GAMES } from '../registry'
import type { GameResult } from '../types'
import { validateGameResult } from '../types'

/**
 * 등록된 모든 게임이 점수를 제대로 내는지 한자리에서 검사한다.
 *
 * 게임을 여러 사람이 나눠 만들고 각자 자기 테스트를 쓰다 보니 검사 범위가
 * 제각각이 됐다 — onFinish를 아예 안 보는 게임도 있었다. 세션은 3판 평균으로
 * 벌칙을 정하므로 한 게임이라도 점수를 안 내면 그 사람만 0점을 먹는다.
 *
 * registry의 GAMES를 그대로 돌기 때문에 새 게임이 등록되는 순간 같이 걸린다.
 */

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

/**
 * 호스트가 기다려주는 만큼 시간을 태운다.
 *
 * timeLimitSec가 아니라 호스트 예산을 기준으로 재는 이유: 몇몇 게임은 제
 * 시간을 다 쓰기 전에 자기 연출을 끼운다(plusminus·gugudan은 시작 전 3초
 * 카운트다운, cardmatch는 판 미리보기 동안 시계 정지). 그래서 실제 종료가
 * timeLimitSec를 넘는다.
 *
 * ⚠️ 이건 계약 위반을 눈감아준 것이다. timeLimitSec는 호스트와의 약속이므로
 * 원래는 그 안에 끝나야 한다. 게임 담당자와 정리할 때까지 실제 예산으로 잰다.
 */
const burnHostBudget = async (timeLimitSec: number) => {
  await act(async () => {
    jest.advanceTimersByTime(timeLimitSec * 1000 + FORCE_FINISH_GRACE_MS)
  })
}

describe.each(GAMES.map((g) => [g.info.id, g] as const))('%s 점수 계약', (id, game) => {
  const { timeLimitSec } = game.info

  it('호스트가 강제 종료하기 전에 스스로 끝낸다', async () => {
    const onFinish = jest.fn()
    await render(
      <game.Component seed={4242} timeLimitSec={timeLimitSec} onFinish={onFinish} />,
    )

    await burnHostBudget(timeLimitSec)

    // 아무도 안 부르면 그 판은 미제출이 되어 0점으로 흡수된다.
    expect(onFinish).toHaveBeenCalled()
  })

  it('계약을 지키는 값을 돌려준다', async () => {
    const onFinish = jest.fn()
    await render(
      <game.Component seed={4242} timeLimitSec={timeLimitSec} onFinish={onFinish} />,
    )

    await burnHostBudget(timeLimitSec)

    const result = onFinish.mock.calls[0][0] as GameResult
    // normalizedScore 0~100, score·tiebreakMs 유한, tiebreakMs >= 0
    expect(validateGameResult(result, id)).toEqual([])
  })

  it('시간을 다 쓴 것은 정상 종료다', async () => {
    const onFinish = jest.fn()
    await render(
      <game.Component seed={4242} timeLimitSec={timeLimitSec} onFinish={onFinish} />,
    )

    await burnHostBudget(timeLimitSec)

    // finished는 "모듈이 제 역할을 하고 끝났나"만 뜻한다. 잘했는지는
    // normalizedScore가 맡는다 (games/types.ts GameResult 주석).
    // 여기서 false가 나오면 호스트가 중도 이탈로 잘못 읽는다.
    const result = onFinish.mock.calls[0][0] as GameResult
    expect(result.finished).toBe(true)
  })

  it('두 번 부르지 않는다', async () => {
    const onFinish = jest.fn()
    await render(
      <game.Component seed={4242} timeLimitSec={timeLimitSec} onFinish={onFinish} />,
    )

    await burnHostBudget(timeLimitSec)
    // 시간이 더 흘러도 다시 부르면 안 된다
    await act(async () => {
      jest.advanceTimersByTime(timeLimitSec * 1000)
    })

    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('같은 시드는 같은 점수를 낸다', async () => {
    const run = async () => {
      const onFinish = jest.fn()
      const view = await render(
        <game.Component seed={777} timeLimitSec={timeLimitSec} onFinish={onFinish} />,
      )
      await burnHostBudget(timeLimitSec)
      // unmount도 act 안에서 해야 한다. 밖에서 하면 act 스코프가 다음
      // 테스트로 새어 나가 그쪽 렌더를 통째로 날린다.
      await act(async () => {
        view.unmount()
      })
      return (onFinish.mock.calls[0][0] as GameResult).normalizedScore
    }

    // 서버는 시드만 내려주고 문제는 각 폰이 만든다. 시드가 같은데 결과가
    // 갈리면 같은 조건에서 겨루는 게 아니게 된다.
    expect(await run()).toBe(await run())
  })
})
