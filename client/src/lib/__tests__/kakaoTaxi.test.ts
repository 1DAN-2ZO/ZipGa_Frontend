import { KAKAO_T_SCHEME, KAKAO_T_STORE, openKakaoTaxi } from '../kakaoTaxi'

/** 열린 URL을 기록하는 가짜. fail에 든 URL은 열지 못한 것으로 친다. */
function fakeOpener(fail: string[] = []) {
  const opened: string[] = []
  return {
    opened,
    openURL: async (url: string) => {
      if (fail.some((f) => url.startsWith(f))) {
        throw new Error(`No Activity found to handle Intent { dat=${url} }`)
      }
      opened.push(url)
      return true
    },
  }
}

describe('상수', () => {
  it('실기기에서 확인된 스킴을 쓴다', () => {
    expect(KAKAO_T_SCHEME).toBe('kakaot://')
  })

  it('스토어 링크가 카카오T 패키지를 가리킨다', () => {
    expect(KAKAO_T_STORE).toContain('com.kakao.taxi')
  })
})

describe('openKakaoTaxi', () => {
  it('설치돼 있으면 카카오T를 연다', async () => {
    const opener = fakeOpener()
    expect(await openKakaoTaxi(opener)).toBe('opened')
    expect(opener.opened).toEqual([KAKAO_T_SCHEME])
  })

  it('성공했으면 스토어는 열지 않는다', async () => {
    const opener = fakeOpener()
    await openKakaoTaxi(opener)
    expect(opener.opened).not.toContain(KAKAO_T_STORE)
  })

  it('미설치면 스토어로 폴백한다', async () => {
    const opener = fakeOpener([KAKAO_T_SCHEME])
    expect(await openKakaoTaxi(opener)).toBe('store')
    expect(opener.opened).toEqual([KAKAO_T_STORE])
  })

  it('스토어까지 실패하면 failed를 반환하고 throw하지 않는다', async () => {
    const opener = fakeOpener([KAKAO_T_SCHEME, KAKAO_T_STORE])
    await expect(openKakaoTaxi(opener)).resolves.toBe('failed')
  })

  it('스킴을 먼저 시도한다 (스토어보다 앞선다)', async () => {
    const tried: string[] = []
    const result = await openKakaoTaxi({
      openURL: async (url: string) => {
        tried.push(url)
        throw new Error('nope')
      },
    })
    expect(tried).toEqual([KAKAO_T_SCHEME, KAKAO_T_STORE])
    expect(result).toBe('failed')
  })
})
