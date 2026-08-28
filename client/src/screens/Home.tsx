import { StyleSheet, Text, View } from 'react-native'
import { PillButton } from '../components/PillButton'
import { ScreenHeader } from '../components/ScreenHeader'
import { colors, fonts } from '../theme/colors'

export interface HomeProps {
  /** 로컬에 저장된 닉네임. 없으면 첫 실행이다. */
  nickname?: string
  /** 로컬에 저장된 방 코드가 있을 때만 "아직 안 갈래"를 보여준다. */
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
      <ScreenHeader title="ZipGa" onSettings={onSettings} />

      {nickname && (
        <View style={styles.greeting}>
          <Text style={styles.greetingText}>{nickname}님, 오늘도 신나게!</Text>
        </View>
      )}

      <View style={styles.spacer} />

      <View style={styles.buttons}>
        {hasStoredRoom && (
          <PillButton label="아직 안 갈래" variant="secondary" onPress={onRejoin} />
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
})
