import {
  APP_STORE,
  KAKAO_T_SCHEME,
  openKakaoTaxi,
  PLAY_STORE,
  storeUrl,
} from '../kakaoTaxi'

/** 네이티브용 가짜. fail에 든 URL은 열지 못한 것으로 친다. */
function fakeOpener(fail: string[] = []) {
  const opened: string[] = []
  return {
    opened,
    openURL: async (url: string) => {
      if (fail.some((f) => url.startsWith(f))) throw new Error(`no activity: ${url}`)
      opened.push(url)
      return true
    },
  }
}

describe('상수', () => {
  it('실기기에서 확인된 스킴을 쓴다', () => {
    expect(KAKAO_T_SCHEME).toBe('kakaot://')
  })

  it('안드로이드 스토어는 카카오T 패키지를 가리킨다', () => {
    expect(PLAY_STORE).toContain('com.kakao.taxi')
  })

  it('iOS 스토어는 카카오T 앱 ID를 가리킨다', () => {
    expect(APP_STORE).toContain('981110422')
  })
})

describe('storeUrl', () => {
  it('iOS면 앱스토어로 보낸다', () => {
    expect(storeUrl(true)).toBe(APP_STORE)
  })

  it('iOS가 아니면 플레이스토어로 보낸다', () => {
    // iOS에서 플레이스토어 링크는 열리기만 하고 설치가 안 된다.
    expect(storeUrl(false)).toBe(PLAY_STORE)
  })
})

describe('openKakaoTaxi — 네이티브', () => {
  it('설치돼 있으면 카카오T를 연다', async () => {
    const opener = fakeOpener()
    const r = await openKakaoTaxi({ platform: 'native', opener })
    expect(r).toBe('opened')
    expect(opener.opened).toEqual([KAKAO_T_SCHEME])
  })

  it('성공했으면 스토어는 열지 않는다', async () => {
    const opener = fakeOpener()
    await openKakaoTaxi({ platform: 'native', opener })
    expect(opener.opened).toHaveLength(1)
  })

  it('미설치면 스토어로 폴백한다', async () => {
    const opener = fakeOpener([KAKAO_T_SCHEME])
    const r = await openKakaoTaxi({ platform: 'native', opener, ios: false })
    expect(r).toBe('store')
    expect(opener.opened).toEqual([PLAY_STORE])
  })

  it('iOS 미설치면 앱스토어로 폴백한다', async () => {
    const opener = fakeOpener([KAKAO_T_SCHEME])
    await openKakaoTaxi({ platform: 'native', opener, ios: true })
    expect(opener.opened).toEqual([APP_STORE])
  })

  it('스토어까지 실패하면 failed를 반환하고 throw하지 않는다', async () => {
    const opener = fakeOpener([KAKAO_T_SCHEME, 'https://'])
    await expect(openKakaoTaxi({ platform: 'native', opener })).resolves.toBe('failed')
  })
})

describe('openKakaoTaxi — 웹', () => {
  /** navigate만 기록하는 가짜. 웹에는 판정할 신호가 없으므로 이게 전부다. */
  function fakeNavigator() {
    const navigated: string[] = []
    return { navigated, navigate: (url: string) => navigated.push(url) }
  }

  it('새 탭이 아니라 현재 탭에서 스킴을 연다', async () => {
    // window.open으로 열면 팝업 차단에 걸리거나 빈 탭만 뜬다.
    const nav = fakeNavigator()
    await openKakaoTaxi({ platform: 'web', navigate: nav.navigate })
    expect(nav.navigated).toEqual([KAKAO_T_SCHEME])
  })

  it('성공 여부를 판정하지 않고 unknown을 돌려준다', async () => {
    // 브라우저는 앱이 열렸는지 알려주지 않는다. 추측하는 대신 모른다고 한다.
    const nav = fakeNavigator()
    await expect(
      openKakaoTaxi({ platform: 'web', navigate: nav.navigate }),
    ).resolves.toBe('unknown')
  })

  it('스토어로 자동 이동시키지 않는다', async () => {
    // 현재 탭을 덮으면 앱이 통째로 사라진다. 화면의 설치 안내로 넘긴다.
    const nav = fakeNavigator()
    await openKakaoTaxi({ platform: 'web', navigate: nav.navigate })
    expect(nav.navigated).toHaveLength(1)
    expect(nav.navigated[0]).not.toContain('store')
  })
})
