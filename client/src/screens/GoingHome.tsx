import { MaterialIcons } from '@expo/vector-icons'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { PillButton } from '../components/PillButton'
import { ScreenHeader } from '../components/ScreenHeader'
import { colors, fonts, radius } from '../theme/colors'
import type { TaxiLaunchResult } from '../lib/kakaoTaxi'

export interface GoingHomeProps {
  /** 벌칙으로 나가는지, 본인이 "집에 갈래"를 눌렀는지 */
  reason: 'penalty' | 'voluntary'
  /** openKakaoTaxi가 돌려준 값. 아직 시도 전이면 null */
  launch: TaxiLaunchResult | null
  onSettings: () => void
  /** 카카오T가 없는 사람이 누른다 */
  onOpenStore: () => void
  /** 재입장. 실제로는 안 갔을 때 */
  onStay: () => void
}

/**
 * 귀가 완료 화면 (S10).
 *
 * 딥링크가 성공하면 사용자는 이미 카카오T로 넘어가 이 화면을 볼 일이 없다.
 * 실패하면 여기를 보게 되므로, 아래 설치 안내가 이 화면의 핵심이다.
 *
 * 웹에서는 앱이 열렸는지 알 방법이 없다(launch === 'unknown').
 * 추측해서 안내를 숨기는 대신 항상 보여준다 — 이미 떠난 사람은 어차피
 * 못 보고, 못 떠난 사람은 눈앞에서 바로 누를 수 있다
 * (설계_웹배포와알림 §B.3).
 */
export function GoingHome({ reason, launch, onSettings, onOpenStore, onStay }: GoingHomeProps) {
  // 네이티브에서만 판정이 진짜 신호다. 열린 게 확실할 때만 안내를 접는다.
  const confirmedOpen = launch === 'opened' && Platform.OS !== 'web'

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

        {!confirmedOpen && (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>카카오T가 없으신가요?</Text>
            <Text style={styles.noticeBody}>앱이 안 열렸다면 여기서 설치하세요.</Text>
            <Pressable style={styles.noticeButton} onPress={onOpenStore}>
              <MaterialIcons name="open-in-new" size={18} color={colors.white} />
              <Text style={styles.noticeButtonText}>설치하러 가기</Text>
            </Pressable>
          </View>
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
  notice: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 6,
    marginTop: 36,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.white,
  },
  noticeTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  noticeBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  noticeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  noticeButtonText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.white,
  },
})
