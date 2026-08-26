import { Platform } from 'react-native'
import { isCompleteRoomCode, normalizeRoomCode } from './roomCode'

/**
 * 이 방으로 초대하는 QR·공유 링크 URL을 만든다.
 *
 * 웹 배포(2026-08-26 배포 목표 변경)에서는 `jipga://` 같은 커스텀 스킴을 처리해줄
 * 네이티브 앱이 없어서 QR을 찍어도 아무 반응이 없다 — 그래서 웹에서는 지금 이 앱이
 * 떠 있는 origin 그대로에 쿼리스트링(`?room=CODE`)을 붙인 진짜 https 링크를 쓴다.
 * 경로가 아니라 쿼리스트링인 이유: 루트(`/`)는 어떤 정적 호스팅에서도 별도 리라이트
 * 설정 없이 항상 서비스되지만, `/join/CODE` 같은 하위 경로는 SPA 리라이트 규칙이
 * 없으면 404가 날 수 있다.
 *
 * 네이티브 빌드가 다시 필요해지는 경우를 대비해 `jipga://` 스킴도 그대로 남겨둔다.
 */
export function buildRoomInviteUrl(code: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/?room=${encodeURIComponent(code)}`
  }
  return `jipga://room/${code}`
}

/**
 * 초대 링크에서 방 코드를 뽑아낸다. 두 형태를 다 받는다:
 *   - `jipga://room/{code}` (네이티브 커스텀 스킴)
 *   - `https://.../?room={code}` (웹 배포용 https 링크)
 *
 * 스캔이 아니라 딥링크로 들어온 경우이므로 코드는 이미 손에 있다 —
 * QR 스캔 화면을 건너뛰고 바로 닉네임 입력으로 간다 (mdfile/프론트엔드_화면명세.md S2).
 */
export function parseRoomDeepLink(url: string): string | null {
  let raw: string | null = null

  const schemeMatch = url.match(/^jipga:\/\/room\/([^/?#]+)/i)
  if (schemeMatch) {
    raw = decodeURIComponent(schemeMatch[1])
  } else {
    try {
      raw = new URL(url).searchParams.get('room')
    } catch {
      raw = null
    }
  }

  if (!raw) return null
  const code = normalizeRoomCode(raw)
  return isCompleteRoomCode(code) ? code : null
}
