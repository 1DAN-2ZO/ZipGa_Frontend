import {
  APP_STORE,
  KAKAO_T_SCHEME,
  openKakaoTaxi,
  PLAY_STORE,
  storeUrl,
  type WebDeps,
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

/**
 * 웹용 가짜 브라우저.
 *
 * navigate가 불리면 어디로 갔는지 기록하고, appOpens가 true면
 * "앱이 열려 페이지가 숨겨졌다"를 흉내 낸다.
 */
function fakeBrowser({ appOpens }: { appOpens: boolean }) {
  const navigated: string[] = []
  let hidden = false
  let listener: (() => void) | null = null
  let timer: (() => void) | null = null

  const web: WebDeps = {
    navigate: (url) => {
      navigated.push(url)
      if (appOpens) {
        hidden = true
        listener?.()
      }
    },
    isHidden: () => hidden,
    onVisibilityChange: (cb) => {
      listener = cb
      return () => {
        listener = null
      }
    },
    delay: (_ms, cb) => {
      timer = cb
      return () => {
        timer = null
      }
    },
  }

  return { web, navigated, fireTimeout: () => timer?.(), hasTimer: () => timer !== null }
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
  it('새 탭이 아니라 현재 탭에서 스킴을 연다', async () => {
    // window.open으로 열면 팝업 차단에 걸리거나 빈 탭만 뜬다.
    const browser = fakeBrowser({ appOpens: true })
    await openKakaoTaxi({ platform: 'web', web: browser.web })
    expect(browser.navigated).toEqual([KAKAO_T_SCHEME])
  })

  it('페이지가 숨겨지면 열린 것으로 본다', async () => {
    const browser = fakeBrowser({ appOpens: true })
    await expect(openKakaoTaxi({ platform: 'web', web: browser.web })).resolves.toBe('opened')
  })

  it('시간이 지나도 그대로면 열리지 않은 것으로 본다', async () => {
    const browser = fakeBrowser({ appOpens: false })
    const promise = openKakaoTaxi({ platform: 'web', web: browser.web })
    browser.fireTimeout()
    await expect(promise).resolves.toBe('failed')
  })

  it('실패해도 스토어로 자동 이동시키지 않는다', async () => {
    // 현재 탭을 덮으면 앱이 통째로 사라진다. 화면의 수동 탈출구로 넘긴다.
    const browser = fakeBrowser({ appOpens: false })
    const promise = openKakaoTaxi({ platform: 'web', web: browser.web })
    browser.fireTimeout()
    await promise
    expect(browser.navigated).toEqual([KAKAO_T_SCHEME])
  })

  it('열린 것으로 판정되면 타이머를 정리한다', async () => {
    const browser = fakeBrowser({ appOpens: true })
    await openKakaoTaxi({ platform: 'web', web: browser.web })
    expect(browser.hasTimer()).toBe(false)
  })

  it('타이머가 먼저 터진 뒤 페이지가 숨겨져도 결과가 안 바뀐다', async () => {
    const browser = fakeBrowser({ appOpens: false })
    const promise = openKakaoTaxi({ platform: 'web', web: browser.web })
    browser.fireTimeout()
    browser.fireTimeout()
    await expect(promise).resolves.toBe('failed')
  })
})
