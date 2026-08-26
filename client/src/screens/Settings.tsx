import { Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { ScreenHeader } from '../components/ScreenHeader'
import { colors, fonts, radius } from '../theme/colors'

export interface SettingsProps {
  soundEffectsEnabled: boolean
  backgroundMusicEnabled: boolean
  onToggleSoundEffects: (value: boolean) => void
  onToggleBackgroundMusic: (value: boolean) => void
  onBack: () => void
  /** 미니게임 확인용 샌드박스로 간다. 개발 빌드에서만 노출된다. */
  onOpenSandbox: () => void
}

export function Settings({
  soundEffectsEnabled,
  backgroundMusicEnabled,
  onToggleSoundEffects,
  onToggleBackgroundMusic,
  onBack,
  onOpenSandbox,
}: SettingsProps) {
  return (
    <View style={styles.screen}>
      <ScreenHeader title="설정" onBack={onBack} />

      <View style={styles.list}>
        <SettingRow label="효과음" value={soundEffectsEnabled} onValueChange={onToggleSoundEffects} />
        <SettingRow label="배경음" value={backgroundMusicEnabled} onValueChange={onToggleBackgroundMusic} />
      </View>

      {/*
        세션 엔진(src/session)이 아직 App에 연결되지 않아서
        로비 "게임 시작"으로는 미니게임을 열 수 없다.
        그때까지 담당자가 자기 게임을 누르고 확인할 통로만 열어둔다.
        릴리즈 번들에서는 __DEV__ 가 false라 통째로 사라진다.
      */}
      {__DEV__ && (
        <Pressable style={styles.devRow} onPress={onOpenSandbox}>
          <Text style={styles.devLabel}>미니게임 확인 (개발용)</Text>
        </Pressable>
      )}
    </View>
  )
}

function SettingRow({
  label,
  value,
  onValueChange,
}: {
  label: string
  value: boolean
  onValueChange: (value: boolean) => void
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.divider, true: colors.primary }}
        thumbColor={colors.white}
      />
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
  list: {
    gap: 10,
    marginTop: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  devRow: {
    marginTop: 24,
    alignItems: 'center',
    paddingVertical: 12,
  },
  devLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.textPrimary,
  },
})
