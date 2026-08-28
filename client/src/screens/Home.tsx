import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native'
import { PillButton } from '../components/PillButton'
import { ScreenHeader } from '../components/ScreenHeader'
import { Watermark } from '../components/Watermark'
import { showAlert } from '../lib/alerts'
import { colors, fonts } from '../theme/colors'

const SHARE_URL = 'https://zip-ga-frontend.vercel.app/'

/**
 * 웹 공유 시트(모바일 브라우저) → 클립보드 복사(데스크톱) → 네이티브 Share 순으로 시도한다.
 * navigator.share는 배포 도메인의 모바일 웹에서만 뜨고, 데스크톱 브라우저에는 없다.
 */
async function shareLink() {
  if (Platform.OS === 'web') {
    const nav = typeof navigator === 'undefined' ? null : navigator
    if (nav?.share) {
      try {
        await nav.share({ title: 'ZipGa', url: SHARE_URL })
      } catch {
        // 사용자가 공유를 취소한 경우 — 무시
      }
      return
    }
    if (nav?.clipboard) {
      await nav.clipboard.writeText(SHARE_URL)
      await showAlert({ title: '링크가 복사됐어요', text: SHARE_URL, icon: 'success' })
      return
    }
    return
  }

  await Share.share({ message: SHARE_URL })
}

export interface HomeProps {
  /** 로컬에 저장된 닉네임. 없으면 첫 실행이다. */
  nickname?: string
  /** 로컬에 저장된 방 코드가 있을 때만 "방 재입장"을 보여준다. */
  hasStoredRoom?: boolean
  onCreateRoom: () => void
  onJoinRoom: () => void
  /** 방 없이 혼자 3판. 로그인도 닉네임도 필요 없다. */
  onSoloPlay: () => void
  onRejoin: () => void
  onSettings: () => void
}

export function Home({
  nickname,
  hasStoredRoom,
  onCreateRoom,
  onJoinRoom,
  onSoloPlay,
  onRejoin,
  onSettings,
}: HomeProps) {
  return (
    <View style={styles.screen}>
      <Watermark />
      <ScreenHeader title="ZipGa" onSettings={onSettings} />

      {nickname && (
        <View style={styles.greeting}>
          <Text style={styles.greetingText}>{nickname}님, 오늘도 신나게!</Text>
        </View>
      )}

      <View style={styles.spacer} />

      <View style={styles.buttons}>
        {hasStoredRoom && (
          <PillButton label="방 재입장" variant="secondary" icon="undo" onPress={onRejoin} />
        )}
        <PillButton label="방 만들기" icon="add" onPress={onCreateRoom} />
        <PillButton label="방 참여하기" variant="secondary" icon="login" onPress={onJoinRoom} />
        <PillButton
          testID="solo-play"
          label="혼자하기"
          variant="secondary"
          icon="person"
          onPress={onSoloPlay}
        />
        <Pressable testID="share-link" onPress={shareLink} style={styles.shareLink} hitSlop={8}>
          <Text style={styles.shareLinkText}>ZipGa 공유하기 🔗</Text>
        </Pressable>
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
    paddingBottom: 40,
  },
  greeting: {
    alignItems: 'center',
    marginTop: 40,
    gap: 6,
  },
  greetingText: {
    fontFamily: fonts.heading,
    fontSize: 22,
    color: colors.primary,
    textAlign: 'center',
  },
  spacer: {
    flex: 1,
  },
  buttons: {
    gap: 12,
  },
  shareLink: {
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 8,
  },
  shareLinkText: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    color: colors.primary,
  },
})
