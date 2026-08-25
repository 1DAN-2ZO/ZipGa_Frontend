import { StyleSheet, Switch, Text, View } from 'react-native'
import { ScreenHeader } from '../components/ScreenHeader'
import { colors, fonts, radius } from '../theme/colors'

export interface SettingsProps {
  soundEffectsEnabled: boolean
  backgroundMusicEnabled: boolean
  onToggleSoundEffects: (value: boolean) => void
  onToggleBackgroundMusic: (value: boolean) => void
  onBack: () => void
}

export function Settings({
  soundEffectsEnabled,
  backgroundMusicEnabled,
  onToggleSoundEffects,
  onToggleBackgroundMusic,
  onBack,
}: SettingsProps) {
  return (
    <View style={styles.screen}>
      <ScreenHeader title="설정" onBack={onBack} />

      <View style={styles.list}>
        <SettingRow label="효과음" value={soundEffectsEnabled} onValueChange={onToggleSoundEffects} />
        <SettingRow label="배경음" value={backgroundMusicEnabled} onValueChange={onToggleBackgroundMusic} />
      </View>
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
  label: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.textPrimary,
  },
})
