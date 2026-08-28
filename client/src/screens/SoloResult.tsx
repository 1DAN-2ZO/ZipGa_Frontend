import { useEffect, useRef } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { PillButton } from '../components/PillButton'
import { ScreenHeader } from '../components/ScreenHeader'
import { useAppSound } from '../sound'
import { colors, fonts, radius } from '../theme/colors'

export interface SoloRoundLine {
  gameName: string
  gameEmoji: string
  normalizedScore: number
}

export interface SoloResultProps {
  /** 판별 성적. 순서가 곧 판 번호다. */
  rounds: SoloRoundLine[]
  /** 3판 평균(0~100). 판정에 쓰이는 유일한 값이다. */
  average: number
  /** games/types.ts의 PENALTY_THRESHOLD와 항상 같아야 한다. */
  threshold: number
  /** 이번 판 시드. 같은 판을 친구에게 불러줄 수 있게 보여준다. */
  seed: number
  onRestart: () => void
  onExit: () => void
  onSettings: () => void
}

/**
 * 혼자 하기 종합 결과.
 *
 * 방 세션(SessionResult)과 두 가지가 다르다. 순위표가 없고(상대가 없다),
 * 기준선 미달이어도 택시를 부르지 않는다 — 벌칙은 같이 있는 사람들 사이의
 * 약속이지 혼자 연습하다 집에 갈 일은 아니다. 기준선 자체는 그대로 보여줘서
 * "방에 들어가면 통과할 실력인지"를 가늠하게 한다.
 */
export function SoloResult({
  rounds,
  average,
  threshold,
  seed,
  onRestart,
  onExit,
  onSettings,
}: SoloResultProps) {
  const passed = average >= threshold
  const sound = useAppSound()

  // 결과가 뜨는 순간 한 번만 울린다. 다시하기로 돌아왔다 오면 새로 울린다.
  const soundedRef = useRef(false)
  useEffect(() => {
    if (soundedRef.current) return
    soundedRef.current = true
    if (passed) sound.survived()
    else sound.penalized()
  }, [passed, sound])

  return (
    <View style={styles.screen}>
      <ScreenHeader title="혼자하기 결과" onSettings={onSettings} />

      <View style={styles.list}>
        {rounds.map((round, index) => (
          <View key={index} style={styles.row}>
            <Text style={styles.rowEmoji}>{round.gameEmoji}</Text>
            <Text style={styles.rowName}>{round.gameName}</Text>
            <Text style={styles.rowScore}>
              {round.normalizedScore.toFixed(0)}
              <Text style={styles.pts}>점</Text>
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.average}>
        <Text style={styles.averageLabel}>3판 평균</Text>
        <Text testID="solo-average" style={[styles.averageValue, !passed && styles.averageFail]}>
          {average.toFixed(0)}
          <Text style={styles.pts}>점</Text>
        </Text>
        <Text style={styles.thresholdText}>{`기준선 ${threshold}점`}</Text>
      </View>

      <View style={styles.outcome}>
        <Text style={[styles.outcomeLabel, !passed && styles.outcomeLabelFail]}>
          {passed ? '통과' : '기준선 미달'}
        </Text>
        <Text style={styles.outcomeMessage}>
          {passed ? '이대로면 방에서도 살아남아요.' : '방이었으면 택시 부를 뻔했어요.'}
        </Text>
        <Text style={styles.seedText}>{`시드 ${seed}`}</Text>
      </View>

      <View style={styles.buttons}>
        <PillButton testID="solo-restart" label="한 판 더" icon="refresh" onPress={onRestart} />
        <PillButton label="그만하기" variant="secondary" icon="home" onPress={onExit} />
      </View>
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
    paddingHorizontal: 18,
  },
  rowEmoji: {
    fontSize: 22,
  },
  rowName: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  rowScore: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.primary,
  },
  pts: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  average: {
    alignItems: 'center',
    marginTop: 26,
    gap: 2,
  },
  averageLabel: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  averageValue: {
    fontFamily: fonts.heading,
    fontSize: 56,
    color: colors.primary,
  },
  averageFail: {
    color: colors.danger,
  },
  thresholdText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  outcome: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  outcomeLabel: {
    fontFamily: fonts.heading,
    fontSize: 26,
    color: colors.good,
  },
  outcomeLabelFail: {
    color: colors.danger,
  },
  outcomeMessage: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
  seedText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
  },
  buttons: {
    gap: 12,
  },
})
