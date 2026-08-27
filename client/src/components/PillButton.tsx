import { MaterialIcons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text } from 'react-native'
import { colors, fonts, radius } from '../theme/colors'

export interface PillButtonProps {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary'
  icon?: keyof typeof MaterialIcons.glyphMap
  disabled?: boolean
  testID?: string
}

export function PillButton({ label, onPress, variant = 'primary', icon, disabled, testID }: PillButtonProps) {
  const isPrimary = variant === 'primary'
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        { backgroundColor: isPrimary ? colors.primary : colors.secondary },
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.label, { color: isPrimary ? colors.white : colors.textPrimary }]}>{label}</Text>
      {icon && (
        <MaterialIcons name={icon} size={20} color={isPrimary ? colors.white : colors.primary} />
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
    paddingHorizontal: 28,
    borderRadius: radius.pill,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 16,
  },
})
