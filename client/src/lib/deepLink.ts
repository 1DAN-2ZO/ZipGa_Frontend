/**
 * jipga://room/{code} 형태의 초대 딥링크에서 방 코드를 뽑아낸다.
 *
 * 스캔이 아니라 딥링크로 들어온 경우이므로 코드는 이미 손에 있다 —
 * QR 스캔 화면을 건너뛰고 바로 닉네임 입력으로 간다 (mdfile/프론트엔드_화면명세.md S2).
 */
export function parseRoomDeepLink(url: string): string | null {
  const match = url.match(/^jipga:\/\/room\/([^/?#]+)/i)
  if (!match) return null
  const code = decodeURIComponent(match[1]).trim()
  return code.length > 0 ? code.toUpperCase() : null
}
