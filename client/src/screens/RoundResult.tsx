import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { RoundScoreRow } from '../room/scores'
import { listRoundScores, subscribeToRoundScores } from '../room/scores'
import { colors, fonts } from '../theme/colors'

export interface RoundResultProps {
  sessionId: string
  roundIndex: number
  myPlayerId: string
  gameName: string
  /** 몇 초 뒤 자동으로 다음 단계(다음 판 또는 세션 종합 결과)로 넘어갈지 */
  onDone: () => void
}

const HOLD_MS = 3000

/**
 * S7 — 판 결과. 다른 참가자·등수는 전혀 안 보여주고 본인 점수만 보여준다
 * (mdfile/프론트엔드_화면명세.md S7 "누적 평균은 절대 노출하지 않는다"는 원칙을
 * 한 걸음 더 밀어붙인 것 — 다른 사람 점수·순위까지 보이면 그 판에서 이미 승부가
 * 다 드러나서 3판째까지 긴장을 유지한다는 취지가 죽는다는 피드백으로 정함).
 */
export function RoundResult({ sessionId, roundIndex, myPlayerId, gameName, onDone }: RoundResultProps) {
  const [myScore, setMyScore] = useState<number | null>(null)

  useEffect(() => {
    function pickMine(rows: RoundScoreRow[]) {
      const mine = rows.find((r) => r.playerId === myPlayerId)
      if (mine) setMyScore(mine.normalized)
    }
    listRoundScores(sessionId, roundIndex).then(pickMine).catch(() => {})
    return subscribeToRoundScores(sessionId, roundIndex, pickMine)
  }, [sessionId, roundIndex, myPlayerId])

  useEffect(() => {
    const timer = setTimeout(onDone, HOLD_MS)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>{gameName}</Text>
      <Text style={styles.subheading}>이번 판 결과</Text>

      {myScore === null ? (
        <Text style={styles.waiting}>제출 대기 중…</Text>
      ) : (
        <Text style={styles.score}>{myScore.toFixed(0)}점</Text>
      )}
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
    gap: 12,
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
    marginBottom: 12,
  },
  score: {
    fontFamily: fonts.heading,
    fontSize: 64,
    color: colors.primary,
  },
  waiting: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
})
