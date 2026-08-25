import { MaterialIcons } from '@expo/vector-icons'
import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ScreenHeader } from '../components/ScreenHeader'
import { colors, fonts, radius } from '../theme/colors'

export interface CreateRoomProps {
  onBack: () => void
  onSettings: () => void
}

function randomRoomCode(): string {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
}

export function CreateRoom({ onBack, onSettings }: CreateRoomProps) {
  const [roomCode] = useState(randomRoomCode)

  return (
    <View style={styles.screen}>
      <ScreenHeader title="ZipGa" onBack={onBack} onSettings={onSettings} />

      <Text style={styles.heading}>QR 코드로 초대하기</Text>
      <Text style={styles.subheading}>친구들에게 화면을 보여주세요.</Text>

      {/* TODO: 실제 QR 생성(jipga://room/{code}) 붙이기 전까지의 임시 자리 */}
      <View style={styles.qrBox}>
        <MaterialIcons name="qr-code-2" size={64} color={colors.primary} style={{ opacity: 0.4 }} />
      </View>

      <View style={styles.codeBadge}>
        <Text style={styles.codeText}>{roomCode}</Text>
      </View>
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
  qrBox: {
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
  codeBadge: {
    alignSelf: 'center',
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.white,
  },
  codeText: {
    fontFamily: fonts.heading,
    fontSize: 28,
    letterSpacing: 4,
    color: colors.textPrimary,
  },
})
