import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Watermark } from '../components/Watermark'
import { ROUNDS_PER_SESSION } from '../games/types'
import { colors, fonts } from '../theme/colors'

export interface SoloRoundResultProps {
  gameName: string
  roundIndex: number
  /** 이 판의 정규화 점수(0~100). 혼자라 제출을 기다릴 일이 없어 항상 확정값이다. */
  normalizedScore: number
  /** 몇 초 뒤 자동으로 다음 판(또는 종합 결과)으로 넘어갈지 */
  onDone: () => void
}

/** 방 세션의 판 결과(S7)와 같은 3초 홀드. 흐름의 리듬을 맞춘다. */
const HOLD_MS = 3000

/**
 * 혼자 하기의 판 결과.
 *
 * 방 세션(RoundResult)은 서버에서 내 점수가 올라오길 기다리지만, 혼자 하기는
 * 게임 모듈이 방금 돌려준 값이 곧 최종이라 대기 상태 자체가 없다.
 * 누적 평균은 여기서도 숨긴다 — 3판째까지 긴장을 남기는 원칙은 그대로다.
 */
export function SoloRoundResult({ gameName, roundIndex, normalizedScore, onDone }: SoloRoundResultProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, HOLD_MS)
    return () => clearTimeout(timer)
  }, [onDone])

  return (
    <View style={styles.screen}>
      <Watermark />
      <Text style={styles.heading}>{gameName}</Text>
      <Text style={styles.subheading}>{`${roundIndex + 1} / ${ROUNDS_PER_SESSION}판`}</Text>

      <Text testID="solo-round-score" style={styles.score}>
        {`${normalizedScore.toFixed(0)}점`}
      </Text>
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
})
