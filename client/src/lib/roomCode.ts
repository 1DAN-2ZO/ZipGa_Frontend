/**
 * 방 코드 정규화.
 *
 * 코드가 들어오는 길이 세 갈래(직접 입력·QR 스캔·딥링크)라 각자 다듬으면
 * 한 곳만 대문자 변환을 빠뜨려도 멀쩡한 코드가 ROOM_NOT_FOUND로 튕긴다.
 * 백엔드 gen_room_code는 대문자만 발급하므로(백엔드_Supabase명세.md §5.1)
 * 들어오는 값은 전부 여기를 거쳐 대문자로 맞춘다.
 */

export const CODE_LENGTH = 6

/**
 * 방 코드에 쓰이는 글자.
 *
 * I·O·0·1이 빠져 있다. 술집 조명에서 불러주고 받아적을 때 헷갈리는 짝들이다.
 */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * 입력값을 방 코드 꼴로 다듬는다.
 *
 * 붙여넣기로 공백이나 소문자가 섞여 들어오는 경우까지 여기서 흡수한다.
 * autoCapitalize는 키보드 힌트일 뿐이라 붙여넣기에는 걸리지 않는다.
 */
export function normalizeRoomCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .split('')
    .filter((ch) => CODE_CHARS.includes(ch))
    .slice(0, CODE_LENGTH)
    .join('')
}

/** 서버에 물어볼 만한 꼴인지. 길이만 맞으면 통과시키고 존재 여부는 서버가 답한다. */
export function isCompleteRoomCode(code: string): boolean {
  return code.length === CODE_LENGTH
}
