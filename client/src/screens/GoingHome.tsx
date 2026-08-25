import { MaterialIcons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { PillButton } from '../components/PillButton'
import { ScreenHeader } from '../components/ScreenHeader'
import { colors, fonts } from '../theme/colors'
import type { TaxiLaunchResult } from '../lib/kakaoTaxi'

export interface GoingHomeProps {
  /** 벌칙으로 나가는지, 본인이 "집에 갈래"를 눌렀는지 */
  reason: 'penalty' | 'voluntary'
  /** openKakaoTaxi가 돌려준 값. 아직 시도 전이면 null */
  launch: TaxiLaunchResult | null
  onSettings: () => void
  /** 수동 탈출구. 카카오T가 안 떴을 때 직접 스토어로 간다 */
  onOpenStore: () => void
  /** 재입장. 실제로는 안 갔을 때 */
  onStay: () => void
}

/**
 * 귀가 완료 화면 (S10).
 *
 * 딥링크가 성공하면 사용자는 이미 카카오T로 넘어가 이 화면을 볼 일이 없다.
 * 실패하면 여기를 보게 되므로, 아래 수동 탈출구가 이 화면의 핵심이다.
 *
 * 미설치 상태에서 Chrome은 아무 반응이 없었고 앱에서 catch가 걸리는지는
 * 실기기로만 확인된다. catch를 유일한 방어선으로 두지 않는다 (설계 §6.0.1).
 */
export function GoingHome({ reason, launch, onSettings, onOpenStore, onStay }: GoingHomeProps) {
  const opened = launch === 'opened'

  return (
    <View style={styles.screen}>
      <ScreenHeader title={reason === 'penalty' ? '집 가' : '집에 갈래'} onSettings={onSettings} />

      <View style={styles.center}>
        <MaterialIcons name="local-taxi" size={72} color={colors.primary} />
        <Text style={styles.headline}>조심히 가세요</Text>
        <Text style={styles.sub}>
          {reason === 'penalty'
            ? '기준선을 못 넘었습니다. 오늘은 여기까지.'
            : '먼저 일어나셨습니다.'}
        </Text>

        {!opened && (
          <Pressable style={styles.escape} onPress={onOpenStore} hitSlop={8}>
            <MaterialIcons name="open-in-new" size={16} color={colors.primary} />
            <Text style={styles.escapeText}>안 열렸나요? 카카오T 설치하기</Text>
          </Pressable>
        )}
      </View>

      <PillButton label="아직 안 갈래" variant="secondary" icon="undo" onPress={onStay} />
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
    gap: 12,
  },
  headline: {
    fontFamily: fonts.heading,
    fontSize: 30,
    color: colors.textPrimary,
    marginTop: 8,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  escape: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 28,
    paddingVertical: 8,
  },
  escapeText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
})
