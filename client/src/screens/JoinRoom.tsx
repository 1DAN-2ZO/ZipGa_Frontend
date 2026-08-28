import { useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { PillButton } from '../components/PillButton'
import { QrScanBox } from '../components/QrScanBox'
import { ScreenHeader } from '../components/ScreenHeader'
import { Watermark } from '../components/Watermark'
import { CODE_LENGTH, isCompleteRoomCode, normalizeRoomCode } from '../lib/roomCode'
import { colors, fonts, radius } from '../theme/colors'

export interface JoinRoomProps {
  onBack: () => void
  onSettings: () => void
  /** 방 코드 6자리를 확정했을 때 (QR 스캔 성공 시에도 동일 경로) */
  onSubmitCode: (code: string) => void
  loading?: boolean
  errorMessage?: string | null
}

export function JoinRoom({ onBack, onSettings, onSubmitCode, loading, errorMessage }: JoinRoomProps) {
  const [code, setCode] = useState('')

  return (
    <View style={styles.screen}>
      <Watermark />
      <ScreenHeader title="ZipGa" onBack={onBack} onSettings={onSettings} />

      <Text style={styles.heading}>QR 코드로 참여하기</Text>
      <Text style={styles.subheading}>화면 중앙에 QR 코드를 맞춰주세요.</Text>

      <QrScanBox paused={loading} onScanned={onSubmitCode} />

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>또는 방 코드 입력</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.codeRow}>
        <TextInput
          testID="room-code-input"
          style={styles.codeInput}
          placeholder="방 코드 6자리"
          placeholderTextColor={colors.textMuted}
          value={code}
          onChangeText={(v) => setCode(normalizeRoomCode(v))}
          maxLength={CODE_LENGTH}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <PillButton
          label={loading ? '참여 중…' : '참여하기'}
          onPress={() => onSubmitCode(code)}
          disabled={!isCompleteRoomCode(code) || loading}
        />
      </View>

      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}
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
  heading: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.primary,
    textAlign: 'center',
    marginTop: 32,
  },
  subheading: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 28,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.divider,
  },
  dividerText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.textMuted,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  codeInput: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textPrimary,
  },
  error: {
    marginTop: 16,
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.primary,
  },
})
