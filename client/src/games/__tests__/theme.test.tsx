import { render, screen } from '@testing-library/react-native'
import React from 'react'
import { StyleSheet } from 'react-native'
import { COLORS } from '../../theme'
import { GAMES } from '../registry'

/**
 * 게임 담당자가 여럿이라 화면 색이 제각각으로 갈라지기 쉽다.
 *
 * 한 세션에서 3판이 연속으로 도는데 판마다 배경이 튀면 같은 앱으로 보이지 않는다.
 * 새 게임이 registry에 등록되는 순간 이 테스트가 같이 검사한다.
 */
describe('게임 공통 톤', () => {
  it('배경은 밝은 회색 하나로 통일한다', () => {
    expect(COLORS.bg).toBe('#E9E9ED')
  })

  it.each(GAMES.map((g) => [g.info.id, g] as const))(
    '%s는 공통 배경색을 쓴다',
    async (_id, game) => {
      await render(
        <game.Component seed={7} timeLimitSec={game.info.timeLimitSec} onFinish={jest.fn()} />,
      )
      const root = StyleSheet.flatten(screen.getByTestId('game-root').props.style)
      expect(root.backgroundColor).toBe(COLORS.bg)
    },
  )

  it.each(GAMES.map((g) => [g.info.id, g] as const))(
    '%s는 어두운 테마 색을 남겨두지 않는다',
    async (_id, game) => {
      // 밝은 배경 위에 예전 어두운 톤이 섞이면 글씨가 안 보이거나 판이 얼룩진다.
      await render(
        <game.Component seed={7} timeLimitSec={game.info.timeLimitSec} onFinish={jest.fn()} />,
      )
      expect(JSON.stringify(screen.toJSON())).not.toMatch(/#12121a|#1a1a26|#1e1e2b|#f5f5f7/i)
    },
  )
})
