import { StyleSheet, Text, View } from 'react-native'
import { PillButton } from '../components/PillButton'
import { ScreenHeader } from '../components/ScreenHeader'
import { Watermark } from '../components/Watermark'
import { ROUNDS_PER_SESSION } from '../games/types'
import { colors, fonts, radius } from '../theme/colors'

export interface SoloLobbyProps {
  nickname?: string
  /** 방장의 "게임 시작"과 같은 자리. 혼자라 준비 인원을 기다릴 필요가 없다. */
  onStart: () => void
  onBack: () => void
  onSettings: () => void
}

/**
 * 혼자 하기 로비.
 *
 * 방 로비(S3)에서 사람 목록과 준비 상태만 걷어낸 화면이다. 방장처럼
 * 시작 버튼을 직접 누르고, 누르는 순간 랜덤 3판이 편성된다.
 */
export function SoloLobby({ nickname, onStart, onBack, onSettings }: SoloLobbyProps) {
  return (
    <View style={styles.screen}>
      <Watermark />
      <ScreenHeader title="혼자하기" onBack={onBack} onSettings={onSettings} />

      <View style={styles.center}>
        <Text style={styles.emoji}>🎲</Text>
        <Text style={styles.heading}>
          {nickname ? `${nickname}님, 혼자서도 한 판!` : '혼자서도 한 판!'}
        </Text>
        <View style={styles.card}>
          <Text style={styles.cardLine}>{`랜덤으로 뽑힌 미니게임 ${ROUNDS_PER_SESSION}판`}</Text>
          <Text style={styles.cardLine}>방도 친구도 필요 없어요</Text>
        </View>
      </View>

      <PillButton testID="solo-start" label="시작하기" icon="play-arrow" onPress={onStart} />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  emoji: {
    fontSize: 64,
  },
  heading: {
    fontFamily: fonts.heading,
    fontSize: 22,
    color: colors.primary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingVertical: 18,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  cardLine: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
})
