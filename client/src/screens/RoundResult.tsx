import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { RoundScoreRow } from '../room/scores'
import { listRoundScores, subscribeToRoundScores } from '../room/scores'
import { colors, fonts, radius } from '../theme/colors'

export interface RoundResultPlayer {
  id: string
  nickname: string
}

export interface RoundResultProps {
  sessionId: string
  roundIndex: number
  players: RoundResultPlayer[]
  myPlayerId: string
  gameName: string
  /** 몇 초 뒤 자동으로 다음 단계(다음 판 또는 세션 종합 결과)로 넘어갈지 */
  onDone: () => void
}

const HOLD_MS = 3000

/**
 * S7 — 판 결과. 이 판의 순위만 보여준다. 누적 평균은 절대 노출하지 않는다
 * (3판째까지 긴장을 유지하기 위함 — mdfile/프론트엔드_화면명세.md S7).
 */
export function RoundResult({ sessionId, roundIndex, players, myPlayerId, gameName, onDone }: RoundResultProps) {
  const [scores, setScores] = useState<RoundScoreRow[]>([])

  useEffect(() => {
    listRoundScores(sessionId, roundIndex).then(setScores).catch(() => {})
    return subscribeToRoundScores(sessionId, roundIndex, setScores)
  }, [sessionId, roundIndex])

  useEffect(() => {
    const timer = setTimeout(onDone, HOLD_MS)
    return () => clearTimeout(timer)
  }, [onDone])

  const nameOf = (playerId: string) => players.find((p) => p.id === playerId)?.nickname ?? '???'

  const ranked = [...scores].sort((a, b) => {
    if (b.normalized !== a.normalized) return b.normalized - a.normalized
    return a.tiebreakMs - b.tiebreakMs
  })

  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>{gameName}</Text>
      <Text style={styles.subheading}>이번 판 순위</Text>

      <View style={styles.list}>
        {ranked.map((row, index) => (
          <View key={row.playerId} style={[styles.row, row.playerId === myPlayerId && styles.rowMe]}>
            <Text style={[styles.rank, row.playerId === myPlayerId && styles.textOnColor]}>{index + 1}</Text>
            <Text style={[styles.name, row.playerId === myPlayerId && styles.textOnColor]}>
              {nameOf(row.playerId)}
            </Text>
            <Text style={[styles.score, row.playerId === myPlayerId && styles.textOnColor]}>
              {row.normalized.toFixed(0)}점
            </Text>
          </View>
        ))}
        {ranked.length === 0 && <Text style={styles.waiting}>제출 대기 중…</Text>}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
    gap: 8,
  },
  heading: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textMuted,
  },
  subheading: {
    fontFamily: fonts.heading,
    fontSize: 24,
    color: colors.primary,
    marginBottom: 20,
  },
  list: {
    width: '100%',
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  rowMe: {
    backgroundColor: colors.primary,
  },
  rank: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.primary,
    width: 24,
  },
  name: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  score: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.primary,
  },
  textOnColor: {
    color: colors.white,
  },
  waiting: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 20,
  },
})
