import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { colors, fonts, radius } from '../theme/colors'
import { PillButton } from './PillButton'

export interface NicknameSheetProps {
  visible: boolean
  /** 로컬에 저장된 닉네임이 있으면 프리필한다 (mdfile/프론트엔드_화면명세.md §4.0) */
  initialNickname?: string
  onConfirm: (nickname: string) => void
  onCancel: () => void
}

export function NicknameSheet({ visible, initialNickname, onConfirm, onCancel }: NicknameSheetProps) {
  const [nickname, setNickname] = useState(initialNickname ?? '')

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/* 여백(backdrop) 클릭 시 닫히게 하되, 시트 안쪽 클릭은 버블링을 막아 안 닫히게 한다 */}
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>닉네임을 알려주세요</Text>
          <TextInput
            testID="nickname-input"
            style={styles.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder="닉네임"
            placeholderTextColor={colors.textMuted}
            maxLength={12}
            autoFocus
          />
          <PillButton
            label="확인"
            onPress={() => onConfirm(nickname.trim())}
            disabled={nickname.trim().length === 0}
          />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26,28,28,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.background,
    borderRadius: 24,
    padding: 24,
    gap: 16,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.primary,
    textAlign: 'center',
  },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: radius.pill,
    paddingHorizontal: 20,
    paddingVertical: 14,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textPrimary,
    textAlign: 'center',
  },
})
