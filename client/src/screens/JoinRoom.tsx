import { MaterialIcons } from '@expo/vector-icons'
import { useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { PillButton } from '../components/PillButton'
import { ScreenHeader } from '../components/ScreenHeader'
import { colors, fonts, radius } from '../theme/colors'

export interface JoinRoomProps {
  onBack: () => void
  onSettings: () => void
  /** 방 코드 6자리를 확정했을 때 (QR 스캔 성공 시에도 동일 경로) */
  onSubmitCode: (code: string) => void
  loading?: boolean
  errorMessage?: string | null
}

const CODE_LENGTH = 6

export function JoinRoom({ onBack, onSettings, onSubmitCode, loading, errorMessage }: JoinRoomProps) {
  const [code, setCode] = useState('')

  return (
    <View style={styles.screen}>
      <ScreenHeader title="ZipGa" onBack={onBack} onSettings={onSettings} />

      <Text style={styles.heading}>QR 코드로 참여하기</Text>
      <Text style={styles.subheading}>화면 중앙에 QR 코드를 맞춰주세요.</Text>

      <View style={styles.scanBox}>
        <MaterialIcons name="qr-code-scanner" size={64} color={colors.primary} style={{ opacity: 0.4 }} />
      </View>

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
          onChangeText={(v) => setCode(v.slice(0, CODE_LENGTH))}
          maxLength={CODE_LENGTH}
          autoCapitalize="characters"
        />
        <PillButton
          label={loading ? '참여 중…' : '참여하기'}
          onPress={() => onSubmitCode(code)}
          disabled={code.length !== CODE_LENGTH || loading}
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
  scanBox: {
    aspectRatio: 1,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
    marginTop: 32,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: '#F1E9FE',
    alignItems: 'center',
    justifyContent: 'center',
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
