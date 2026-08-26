import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import { PillButton } from '../components/PillButton'
import { ScreenHeader } from '../components/ScreenHeader'
import { buildRoomInviteUrl } from '../lib/deepLink'
import { colors, fonts, radius } from '../theme/colors'

export interface CreateRoomProps {
  /** null이면 로딩 중, 문자열이면 발급된 방 코드 */
  roomCode: string | null
  /** 지금 이 방에 접속 중인 인원 수 (Supabase Presence) */
  onlineCount: number
  errorMessage?: string | null
  onBack: () => void
  onSettings: () => void
  /** 있으면 "다 들어왔어요" 버튼을 보여준다. 방을 새로 만든 경우에만 넘긴다 */
  onDone?: () => void
}

export function CreateRoom({ roomCode, onlineCount, errorMessage, onBack, onSettings, onDone }: CreateRoomProps) {
  return (
    <View style={styles.screen}>
      <ScreenHeader title="ZipGa" onBack={onBack} onSettings={onSettings} />

      <Text style={styles.heading}>QR 코드로 초대하기</Text>
      <Text style={styles.subheading}>친구들에게 화면을 보여주세요.</Text>

      <View style={styles.qrBox}>
        {roomCode ? (
          <QRCode value={buildRoomInviteUrl(roomCode)} size={220} color={colors.textPrimary} backgroundColor="transparent" />
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>

      {roomCode && (
        <View style={styles.codeBadge}>
          <Text style={styles.codeText}>{roomCode}</Text>
        </View>
      )}

      {roomCode && <Text style={styles.onlineCount}>{onlineCount}명 들어왔어요</Text>}

      {errorMessage && <Text style={styles.error}>{errorMessage}</Text>}

      <View style={styles.spacer} />

      {onDone && roomCode && <PillButton label="다 들어왔어요" onPress={onDone} />}
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
  spacer: {
    flex: 1,
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
    backgroundColor: colors.primarySoft,
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
  onlineCount: {
    marginTop: 12,
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  error: {
    marginTop: 16,
    textAlign: 'center',
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.primary,
  },
})
