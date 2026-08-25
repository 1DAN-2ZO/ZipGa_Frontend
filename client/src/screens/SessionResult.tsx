import { useEffect, useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ScreenHeader } from '../components/ScreenHeader'
import { colors, fonts, radius } from '../theme/colors'

const AUTO_ADVANCE_MS = 3000

export interface ResultPlayer {
  id: string
  nickname: string
  avgScore: number
}

export interface SessionResultProps {
  players: ResultPlayer[]
  /** 앱 전역 상수. games/types.ts의 PENALTY_THRESHOLD와 항상 같아야 한다. */
  threshold: number
  myPlayerId: string
  onSettings: () => void
  /** 벌칙자: 3초 뒤 자동으로 호출된다. 딥링크+강퇴 연출로 넘어간다 */
  onCallTaxi: () => void
  /** 통과자: 3초 뒤 자동으로 호출된다. 로비로 돌아간다 */
  onBackToLobby: () => void
}

export function SessionResult({
  players,
  threshold,
  myPlayerId,
  onSettings,
  onCallTaxi,
  onBackToLobby,
}: SessionResultProps) {
  const sorted = [...players].sort((a, b) => b.avgScore - a.avgScore)
  const myScore = sorted.find((p) => p.id === myPlayerId)?.avgScore ?? threshold
  const iAmPenalized = myScore < threshold

  const advanceRef = useRef(false)
  useEffect(() => {
    advanceRef.current = false
    const advance = iAmPenalized ? onCallTaxi : onBackToLobby
    const timer = setTimeout(() => {
      if (advanceRef.current) return
      advanceRef.current = true
      advance()
    }, AUTO_ADVANCE_MS)
    return () => clearTimeout(timer)
  }, [iAmPenalized, onCallTaxi, onBackToLobby])

  return (
    <View style={styles.screen}>
      <ScreenHeader title="최종 결과" onSettings={onSettings} />

      <View style={styles.list}>
        {sorted.map((player, index) => (
          <View key={player.id}>
            {index > 0 && sorted[index - 1].avgScore >= threshold && player.avgScore < threshold && (
              <ThresholdDivider threshold={threshold} />
            )}
            <ResultRow
              player={player}
              rank={index + 1}
              penalized={player.avgScore < threshold}
              isWinner={index === 0}
            />
          </View>
        ))}
      </View>

      <View style={styles.outcome}>
        <Text style={styles.outcomeLabel}>{iAmPenalized ? '탈락' : '생존'}</Text>
        <Text style={styles.outcomeMessage}>
          {iAmPenalized ? '3초 후에 택시를 호출합니다.' : '3초 후에 대기실로 이동합니다.'}
        </Text>
      </View>
    </View>
  )
}

function ThresholdDivider({ threshold }: { threshold: number }) {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>기준선 {threshold}점</Text>
      <View style={styles.dividerLine} />
    </View>
  )
}

function ResultRow({
  player,
  rank,
  penalized,
  isWinner,
}: {
  player: ResultPlayer
  rank: number
  penalized: boolean
  isWinner: boolean
}) {
  return (
    <View style={[styles.row, isWinner && styles.rowWinner, penalized && styles.rowPenalized]}>
      <View style={styles.rankBadge}>
        <Text style={[styles.rankText, isWinner && styles.rankTextWinner]}>{rank}</Text>
      </View>
      <View style={styles.nameCol}>
        {isWinner && <Text style={styles.winnerLabel}>우승자</Text>}
        <Text style={[styles.name, penalized && styles.nameOnColor]}>{player.nickname}</Text>
      </View>
      <Text style={[styles.score, penalized && styles.scorePenalized]}>
        {player.avgScore.toFixed(0)}{' '}
        <Text style={[styles.pts, penalized && styles.ptsPenalized]}>pts</Text>
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  list: {
    gap: 10,
    marginTop: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowWinner: {
    backgroundColor: colors.secondary,
  },
  rowPenalized: {
    backgroundColor: colors.primary,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  rankTextWinner: {
    color: colors.primary,
  },
  nameCol: {
    flex: 1,
  },
  winnerLabel: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    color: colors.primary,
  },
  name: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  nameOnColor: {
    color: colors.white,
  },
  score: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.primary,
  },
  scorePenalized: {
    color: colors.white,
  },
  pts: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.textMuted,
  },
  ptsPenalized: {
    color: colors.secondary,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.primary,
    opacity: 0.4,
  },
  dividerText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.primary,
  },
  outcome: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  outcomeLabel: {
    fontFamily: fonts.heading,
    fontSize: 48,
    color: colors.primary,
  },
  outcomeMessage: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.textSecondary,
  },
})
