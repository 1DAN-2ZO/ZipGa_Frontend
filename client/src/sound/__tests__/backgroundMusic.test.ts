import { shouldPlayMusic } from '../useBackgroundMusic'

describe('shouldPlayMusic', () => {
  it('설정이 켜져 있고 앱이 앞에 있으면 흐른다', () => {
    expect(shouldPlayMusic(true, 'active')).toBe(true)
  })

  it('홈 키로 나가면 멎는다', () => {
    // 브라우저는 탭이 가려져도 소리를 계속 내준다. 명시적으로 멈춰야 한다.
    expect(shouldPlayMusic(true, 'background')).toBe(false)
  })

  it('전환 중에도 멎는다', () => {
    // iOS는 전화가 오거나 앱 전환기를 열면 background 전에 이 상태를 거친다.
    expect(shouldPlayMusic(true, 'inactive')).toBe(false)
  })

  it('설정을 끄면 앞에 있어도 안 흐른다', () => {
    expect(shouldPlayMusic(false, 'active')).toBe(false)
  })

  it('설정이 꺼진 채 나가도 안 흐른다', () => {
    expect(shouldPlayMusic(false, 'background')).toBe(false)
  })
})
