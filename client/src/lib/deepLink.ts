import { Platform } from 'react-native'
import { isCompleteRoomCode, normalizeRoomCode } from './roomCode'

/**
 * 이 방으로 초대하는 QR·공유 링크 URL을 만든다.
 *
 * 웹 배포에서는 `jipga://` 같은 커스텀 스킴을 처리해줄 네이티브 앱이 없어서 QR을
 * 찍어도 아무 반응이 없다 — 그래서 웹에서는 지금 이 앱이 떠 있는 origin에 경로를
 * 붙인 진짜 https 링크를 쓴다: `https://도메인/room/{코드}`.
 *
 * 쿼리스트링이 아니라 경로인 이유: 링크가 더 깔끔하고 QR도 짧아진다
 * (webDistribution.md §A.1). 대신 호스팅에 SPA fallback(모든 경로 → /index.html)이
 * 필요하다 — Vercel·Cloudflare Pages 둘 다 설정 한 줄이다.
 *
 * 네이티브 빌드가 다시 필요해지는 경우를 대비해 `jipga://` 스킴도 그대로 남겨둔다.
 */
export function buildRoomInviteUrl(code: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/room/${encodeURIComponent(code)}`
  }
  return `jipga://room/${code}`
}

/**
 * 초대 링크에서 방 코드를 뽑아낸다. 세 형태를 다 받는다:
 *   - `jipga://room/{code}` (네이티브 커스텀 스킴)
 *   - `https://.../room/{code}` (웹 배포용 경로 방식, §A.1)
 *   - `https://.../?room={code}` (예전 쿼리스트링 방식 — 이미 공유된 링크가 있을 수 있어 계속 받는다)
 *
 * 스캔이 아니라 딥링크로 들어온 경우이므로 코드는 이미 손에 있다 —
 * QR 스캔 화면을 건너뛰고 바로 닉네임 입력으로 간다 (frontend.md S2).
 */
export function parseRoomDeepLink(url: string): string | null {
  let raw: string | null = null

  const schemeMatch = url.match(/^jipga:\/\/room\/([^/?#]+)/i)
  if (schemeMatch) {
    raw = decodeURIComponent(schemeMatch[1])
  } else {
    try {
      const parsed = new URL(url)
      const pathMatch = parsed.pathname.match(/\/room\/([^/?#]+)/i)
      raw = pathMatch ? decodeURIComponent(pathMatch[1]) : parsed.searchParams.get('room')
    } catch {
      raw = null
    }
  }

  if (!raw) return null
  const code = normalizeRoomCode(raw)
  return isCompleteRoomCode(code) ? code : null
}
