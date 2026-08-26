import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { ScreenHeader } from '../components/ScreenHeader'
import { colors, fonts } from '../theme/colors'

export interface NextSessionWaitProps {
  onSettings: () => void
}

/**
 * S11 — 다음 세션 대기.
 *
 * 세션이 이미 진행 중일 때 새로 입장하거나 재입장한 사람이 보는 화면이다.
 * 게임 3개와 시드가 이미 배포된 뒤라 중간에 끼지 않는다 — 관전 기능도 넣지 않는다
 * (mdfile/프론트엔드_화면명세.md S11). 세션이 끝나면 자동으로 로비로 돌아간다.
 */
export function NextSessionWait({ onSettings }: NextSessionWaitProps) {
  return (
    <View style={styles.screen}>
      <ScreenHeader title="ZipGa" onSettings={onSettings} />

      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.heading}>지금 게임이 진행 중이에요</Text>
        <Text style={styles.sub}>다음 게임부터 참여할 수 있어요</Text>
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
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  heading: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
})
