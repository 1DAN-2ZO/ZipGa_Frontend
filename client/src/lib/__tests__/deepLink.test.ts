import { buildRoomInviteUrl, parseRoomDeepLink } from '../deepLink'

describe('parseRoomDeepLink', () => {
  it('jipga://room/{code}에서 코드를 뽑아낸다', () => {
    expect(parseRoomDeepLink('jipga://room/684acd')).toBe('684ACD')
  })

  it('대소문자를 대문자로 통일한다', () => {
    expect(parseRoomDeepLink('jipga://room/abc234')).toBe('ABC234')
  })

  it('쿼리스트링이 붙어도 코드만 뽑아낸다', () => {
    expect(parseRoomDeepLink('jipga://room/684acd?utm_source=qr')).toBe('684ACD')
  })

  it('room 경로가 아니면 null이다', () => {
    expect(parseRoomDeepLink('jipga://settings')).toBeNull()
  })

  it('관계 없는 URL이면 null이다', () => {
    expect(parseRoomDeepLink('https://example.com')).toBeNull()
  })

  it('https 링크의 /room/{code} 경로에서 코드를 뽑아낸다', () => {
    expect(parseRoomDeepLink('https://zipga.app/room/684acd')).toBe('684ACD')
  })

  it('https 경로 링크도 대소문자를 대문자로 통일한다', () => {
    expect(parseRoomDeepLink('https://zipga.app/room/abc234')).toBe('ABC234')
  })

  it('경로 방식 https 링크는 room이 아닌 다른 경로면 null이다', () => {
    expect(parseRoomDeepLink('https://zipga.app/settings')).toBeNull()
  })

  it('예전 쿼리스트링 방식(?room=)도 계속 받는다', () => {
    expect(parseRoomDeepLink('https://zipga.app/?room=684acd')).toBe('684ACD')
  })

  it('room 쿼리스트링 값이 6자리 미만이면 null이다', () => {
    expect(parseRoomDeepLink('https://zipga.app/?room=abc')).toBeNull()
  })
})

describe('buildRoomInviteUrl', () => {
  it('네이티브(웹이 아닌) 환경에서는 jipga 스킴을 쓴다', () => {
    expect(buildRoomInviteUrl('ABC234')).toBe('jipga://room/ABC234')
  })
})
