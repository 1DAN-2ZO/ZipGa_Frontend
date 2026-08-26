import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { getGame } from '../games/registry'
import type { RoundPlan } from '../session/lineup'
import { colors, fonts, radius } from '../theme/colors'

export interface GameRevealProps {
  plan: RoundPlan[]
  /** 세 판이 다 공개된 뒤 자동으로 부른다 (LINEUP_SHOWN) */
  onDone: () => void
}

// 서버가 주는 리드타임이 고정 5초라, 여기서 너무 오래 끌면 카운트다운(S5) 볼 시간이 없어진다.
const REVEAL_INTERVAL_MS = 350
const HOLD_AFTER_MS = 400

/**
 * S4 — 게임 3개 공개. 슬롯머신처럼 한 판씩 확정되고, 전원 화면에서
 * 같은 타이밍으로 재생된 뒤 자동으로 카운트다운(S5)으로 넘어간다.
 */
export function GameReveal({ plan, onDone }: GameRevealProps) {
  const [revealedCount, setRevealedCount] = useState(0)

  useEffect(() => {
    if (revealedCount >= plan.length) {
      const timer = setTimeout(onDone, HOLD_AFTER_MS)
      return () => clearTimeout(timer)
    }
    const timer = setTimeout(() => setRevealedCount((c) => c + 1), REVEAL_INTERVAL_MS)
    return () => clearTimeout(timer)
  }, [revealedCount, plan.length, onDone])

  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>이번 세션의 게임</Text>

      <View style={styles.list}>
        {plan.map((round, index) => {
          const revealed = index < revealedCount
          const game = revealed ? getGame(round.gameId) : null
          return (
            <View key={round.roundIndex} style={styles.card}>
              {game ? (
                <>
                  <Text style={styles.emoji}>{game.info.emoji}</Text>
                  <Text style={styles.name}>{game.info.name}</Text>
                  <Text style={styles.desc}>{game.info.desc}</Text>
                </>
              ) : (
                <Text style={styles.emoji}>❔</Text>
              )}
            </View>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 28,
  },
  heading: {
    fontFamily: fonts.heading,
    fontSize: 22,
    color: colors.primary,
  },
  list: {
    width: '100%',
    gap: 14,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingVertical: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 4,
    minHeight: 96,
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 36,
  },
  name: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.textPrimary,
  },
  desc: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
})
