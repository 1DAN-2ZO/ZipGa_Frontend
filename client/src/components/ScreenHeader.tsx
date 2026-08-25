import { MaterialIcons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, fonts } from '../theme/colors'

export interface ScreenHeaderProps {
  title: string
  onBack?: () => void
  onSettings?: () => void
  leadingIcon?: keyof typeof MaterialIcons.glyphMap
  /** 있으면 leadingIcon을 누를 수 있게 만든다 */
  onLeadingIconPress?: () => void
}

export function ScreenHeader({ title, onBack, onSettings, leadingIcon, onLeadingIconPress }: ScreenHeaderProps) {
  return (
    <View style={styles.row}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
        </Pressable>
      ) : leadingIcon ? (
        <Pressable onPress={onLeadingIconPress} hitSlop={12} disabled={!onLeadingIconPress}>
          <MaterialIcons name={leadingIcon} size={24} color={colors.primary} />
        </Pressable>
      ) : (
        <View style={styles.iconSlot} />
      )}
      <Text style={styles.title}>{title}</Text>
      {onSettings ? (
        <Pressable onPress={onSettings} hitSlop={12}>
          <MaterialIcons name="settings" size={24} color={colors.primary} />
        </Pressable>
      ) : (
        <View style={styles.iconSlot} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconSlot: {
    width: 24,
    height: 24,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.primary,
  },
})
