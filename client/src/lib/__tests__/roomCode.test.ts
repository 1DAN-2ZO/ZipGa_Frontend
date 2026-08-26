import { CODE_LENGTH, isCompleteRoomCode, normalizeRoomCode } from '../roomCode'

/**
 * 코드가 들어오는 길이 세 갈래(직접 입력·QR 스캔·딥링크)라, 한 곳만
 * 대문자 변환을 빠뜨려도 멀쩡한 코드가 ROOM_NOT_FOUND로 튕긴다.
 */
describe('normalizeRoomCode', () => {
  it('소문자를 대문자로 올린다', () => {
    // autoCapitalize는 키보드 힌트일 뿐이라 붙여넣기에는 걸리지 않는다.
    expect(normalizeRoomCode('abc234')).toBe('ABC234')
  })

  it('앞뒤 공백을 버린다', () => {
    expect(normalizeRoomCode('  ABC234  ')).toBe('ABC234')
  })

  it('코드에 없는 글자를 걸러낸다', () => {
    // gen_room_code가 쓰는 글자는 ABCDEFGHJKLMNPQRSTUVWXYZ23456789 뿐이다.
    // I·O·0·1은 술집 조명에서 헷갈려서 애초에 발급되지 않는다.
    expect(normalizeRoomCode('AB-C2 34')).toBe('ABC234')
    expect(normalizeRoomCode('ABC01I0')).toBe('ABC')
  })

  it('6자리를 넘으면 잘라낸다', () => {
    expect(normalizeRoomCode('ABC234XYZ')).toBe('ABC234')
    expect(normalizeRoomCode('ABC234XYZ')).toHaveLength(CODE_LENGTH)
  })

  it('빈 문자열은 빈 문자열로 둔다', () => {
    expect(normalizeRoomCode('')).toBe('')
    expect(normalizeRoomCode('   ')).toBe('')
  })
})

describe('isCompleteRoomCode', () => {
  it('6자리여야 참여를 시도한다', () => {
    expect(isCompleteRoomCode('ABC234')).toBe(true)
    expect(isCompleteRoomCode('ABC23')).toBe(false)
    expect(isCompleteRoomCode('')).toBe(false)
  })
})
