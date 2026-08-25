import { MaterialIcons } from '@expo/vector-icons'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { PillButton } from '../components/PillButton'
import { ScreenHeader } from '../components/ScreenHeader'
import { colors, fonts, radius } from '../theme/colors'

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
  /** 벌칙자: 카운트다운이 끝난 뒤 딥링크+강퇴 연출로 넘어간다 */
  onCallTaxi: () => void
  /** 통과자: 로비로 돌아간다 */
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
  const isPenalized = sorted.find((p) => p.id === myPlayerId)?.avgScore ?? threshold
  const iAmPenalized = isPenalized < threshold

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

      {iAmPenalized ? (
        <TaxiButton onDone={onCallTaxi} />
      ) : (
        <PillButton label="로비로 돌아가기" icon="power-settings-new" onPress={onBackToLobby} />
      )}
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

/** 벌칙 카운트다운. 0이 되면 정확히 한 번 onDone을 부른다. */
function TaxiButton({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState<number | null>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    if (count === null) return
    if (count === 0) {
      if (!doneRef.current) {
        doneRef.current = true
        onDone()
      }
      return
    }
    const timer = setTimeout(() => setCount((c) => (c ?? 1) - 1), 1000)
    return () => clearTimeout(timer)
  }, [count, onDone])

  if (count !== null) {
    return (
      <View style={styles.countdown}>
        <Text style={styles.countdownText}>{count > 0 ? count : '집 가'}</Text>
      </View>
    )
  }

  return <PillButton label="택시 부르기" variant="secondary" icon="local-taxi" onPress={() => setCount(3)} />
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
    flex: 1,
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
  countdown: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  countdownText: {
    fontFamily: fonts.heading,
    fontSize: 28,
    color: colors.primary,
  },
})
