import { render, screen } from '@testing-library/react-native'
import React from 'react'
import { StyleSheet } from 'react-native'
import { getGame } from '../registry'

/**
 * 두드리는 게임에서 글자가 드래그 선택되지 않아야 한다.
 *
 * react-native-web은 Text를 선택 가능한 요소로 그린다. 그래서 웹에서
 * 숫자 위를 빠르게 연타하면 글자가 파랗게 잡히고 커서가 텍스트 선택으로
 * 바뀐다 — 두드리는 맛이 끊기고 화면이 지저분해진다. 팀이 웹으로 배포하는
 * 중이라 이게 그대로 사용자에게 간다.
 *
 * user-select는 CSS 상속이라 루트에만 걸면 자식 Text까지 따라온다.
 * 여기서는 루트에 실제로 걸려 있는지만 확인한다.
 */

/** 손가락으로 두드리거나 끄는 게임들. 입력창이 있는 게임은 넣으면 안 된다. */
const TAP_GAMES = [
  'tapRush',
  'whackAMole',
  'cardmatch',
  'leftRight',
  'rulercatch',
  'spotDiff',
] as const

describe.each(TAP_GAMES)('%s', (id) => {
  it('루트에서 글자 선택을 막는다', async () => {
    const game = getGame(id)
    await render(
      <game.Component seed={4242} timeLimitSec={game.info.timeLimitSec} onFinish={jest.fn()} />,
    )

    const root = StyleSheet.flatten(screen.getByTestId('game-root').props.style)
    expect(root.userSelect).toBe('none')
  })
})

/**
 * 반대로 글자를 쳐야 하는 게임은 선택을 막으면 안 된다.
 * 입력칸에서 잘못 친 글자를 지우거나 고르지 못하면 오히려 불편해진다.
 */
describe.each(['sentenceCopy', 'plusminus', 'gugudan'] as const)('%s', (id) => {
  it('입력하는 게임은 선택을 막지 않는다', async () => {
    const game = getGame(id)
    await render(
      <game.Component seed={4242} timeLimitSec={game.info.timeLimitSec} onFinish={jest.fn()} />,
    )

    const root = StyleSheet.flatten(screen.getByTestId('game-root').props.style)
    expect(root.userSelect).toBeUndefined()
  })
})
