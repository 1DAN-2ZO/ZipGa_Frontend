import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { PillButton } from '../components/PillButton'
import { ScreenHeader } from '../components/ScreenHeader'
import { Watermark } from '../components/Watermark'
import { colors, fonts } from '../theme/colors'

export interface NextSessionWaitProps {
  onSettings: () => void
  /** 기다리다 말고 방을 나간다. 이 화면에 갇히지 않게 하는 유일한 출구다 */
  onLeaveRoom: () => void
}

/**
 * S11 — 다음 세션 대기.
 *
 * 세션이 이미 진행 중일 때 새로 입장하거나 재입장한 사람이 보는 화면이다.
 * 게임 3개와 시드가 이미 배포된 뒤라 중간에 끼지 않는다 — 관전 기능도 넣지 않는다
 * (mdfile/프론트엔드_화면명세.md S11). 세션이 끝나면 자동으로 로비로 돌아간다.
 */
export function NextSessionWait({ onSettings, onLeaveRoom }: NextSessionWaitProps) {
  return (
    <View style={styles.screen}>
      <Watermark />
      <ScreenHeader title="ZipGa" onSettings={onSettings} />

      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.heading}>지금 게임이 진행 중이에요</Text>
        <Text style={styles.sub}>다음 게임부터 참여할 수 있어요</Text>
      </View>

      {/*
        출구가 없으면 앞 세션이 비정상 종료됐을 때 이 화면에 갇힌다.
        세션을 닫는 건 end_session 하나뿐인데 그건 3판을 끝낸 사람만 부르므로,
        도중에 전원이 나가면 아무도 안 부르고 화면이 영영 안 넘어간다.
      */}
      <PillButton label="집에 갈래" variant="secondary" onPress={onLeaveRoom} />
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
