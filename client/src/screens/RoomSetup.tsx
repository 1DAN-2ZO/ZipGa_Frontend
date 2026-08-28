import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { PillButton } from '../components/PillButton'
import { ScreenHeader } from '../components/ScreenHeader'
import { Watermark } from '../components/Watermark'
import { colors, fonts, radius } from '../theme/colors'

export interface RoomSetupProps {
  onBack: () => void
  onSettings: () => void
  /** 다음(CreateRoom)으로 넘어갈 때 고른 게임 텀(분)을 같이 넘긴다 */
  onNext: (intervalMinutes: number) => void
}

/** 백엔드 set_session_period가 30/45/60만 허용한다 (mdfile/백엔드_Supabase명세.md §5.9). */
const INTERVAL_OPTIONS = [
  { minutes: 30, label: '30분' },
  { minutes: 45, label: '45분' },
  { minutes: 60, label: '1시간' },
]

export function RoomSetup({ onBack, onSettings, onNext }: RoomSetupProps) {
  const [selected, setSelected] = useState(INTERVAL_OPTIONS[0].minutes)

  return (
    <View style={styles.screen}>
      <Watermark />
      <ScreenHeader title="ZipGa" onBack={onBack} onSettings={onSettings} />

      <Text style={styles.heading}>방 세팅</Text>

      <Text style={styles.label}>게임 텀</Text>
      <View style={styles.toggleRow}>
        {INTERVAL_OPTIONS.map((option) => {
          const active = option.minutes === selected
          return (
            <Pressable
              key={option.minutes}
              onPress={() => setSelected(option.minutes)}
              style={[styles.toggle, active && styles.toggleActive]}
            >
              <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{option.label}</Text>
            </Pressable>
          )
        })}
      </View>

      <View style={styles.spacer} />

      <PillButton label="다음으로" onPress={() => onNext(selected)} />
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
  heading: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.primary,
    textAlign: 'center',
    marginTop: 32,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 40,
    marginBottom: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  toggle: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  toggleTextActive: {
    color: colors.white,
  },
  spacer: {
    flex: 1,
  },
})
