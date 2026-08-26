import { MaterialIcons } from '@expo/vector-icons'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useRef } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { parseRoomDeepLink } from '../lib/deepLink'
import { isCompleteRoomCode, normalizeRoomCode } from '../lib/roomCode'
import { colors, fonts, radius } from '../theme/colors'

export interface QrScanBoxProps {
  /** 코드를 읽어냈을 때. 이미 정규화된 대문자 6자리다 */
  onScanned: (code: string) => void
  /** 참여 요청이 진행 중이면 스캔을 멈춘다 */
  paused?: boolean
}

/**
 * 초대 QR을 읽는 카메라 상자.
 *
 * 우리가 발급하는 QR은 `jipga://room/{코드}`지만, 코드만 담긴 QR을 만들어
 * 공유하는 사람도 있어서 두 형태를 모두 받는다.
 *
 * 권한을 거부해도 화면을 막지 않는다 — 아래 코드 직접 입력이 항상 살아 있어야
 * 한다 (프론트엔드_화면명세.md S2 "어두운 술집에서 스캔이 실패하는 경우가 흔하다").
 */
export function QrScanBox({ onScanned, paused }: QrScanBoxProps) {
  const [permission, requestPermission] = useCameraPermissions()
  // 카메라는 같은 코드를 초당 여러 번 올린다. 첫 번째만 쓴다.
  const handledRef = useRef(false)

  if (!permission) {
    // 권한 상태를 아직 읽는 중이다. 빈 상자로 자리만 잡아둔다.
    return <View style={styles.box} />
  }

  if (!permission.granted) {
    return (
      <Pressable style={styles.box} onPress={requestPermission}>
        <MaterialIcons name="photo-camera" size={48} color={colors.primary} />
        <Text style={styles.prompt}>
          {permission.canAskAgain
            ? '카메라를 켜서 QR을 읽을게요'
            : '설정에서 카메라 권한을 켜주세요'}
        </Text>
        <Text style={styles.hint}>아래에 코드를 직접 입력해도 돼요</Text>
      </Pressable>
    )
  }

  return (
    <View style={styles.box}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={
          paused || handledRef.current
            ? undefined
            : ({ data }) => {
                const code = readRoomCode(data)
                if (!code) return
                handledRef.current = true
                onScanned(code)
              }
        }
      />
      <View pointerEvents="none" style={styles.reticle} />
    </View>
  )
}

/**
 * QR 안의 문자열에서 방 코드를 꺼낸다.
 *
 * 우리 QR이 아니면(가게 와이파이 QR 같은 것) null을 돌려 그냥 무시한다.
 */
function readRoomCode(data: string): string | null {
  const fromLink = parseRoomDeepLink(data)
  if (fromLink) return normalizeRoomCode(fromLink)

  const bare = normalizeRoomCode(data)
  return isCompleteRoomCode(bare) && bare.length === data.trim().length ? bare : null
}

const styles = StyleSheet.create({
  box: {
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
    gap: 10,
    overflow: 'hidden',
  },
  reticle: {
    width: '62%',
    aspectRatio: 1,
    borderRadius: radius.pill / 40,
    borderWidth: 3,
    borderColor: colors.white,
    opacity: 0.9,
  },
  prompt: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.textPrimary,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
})
