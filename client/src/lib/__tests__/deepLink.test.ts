import { parseRoomDeepLink } from '../deepLink'

describe('parseRoomDeepLink', () => {
  it('jipga://room/{code}에서 코드를 뽑아낸다', () => {
    expect(parseRoomDeepLink('jipga://room/684acd')).toBe('684ACD')
  })

  it('대소문자를 대문자로 통일한다', () => {
    expect(parseRoomDeepLink('jipga://room/AbC123')).toBe('ABC123')
  })

  it('쿼리스트링이 붙어도 코드만 뽑아낸다', () => {
    expect(parseRoomDeepLink('jipga://room/684ACD?utm_source=qr')).toBe('684ACD')
  })

  it('room 경로가 아니면 null이다', () => {
    expect(parseRoomDeepLink('jipga://settings')).toBeNull()
  })

  it('관계 없는 URL이면 null이다', () => {
    expect(parseRoomDeepLink('https://example.com')).toBeNull()
  })
})
