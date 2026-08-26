import { Linking, Platform } from 'react-native'

/**
 * 카카오T 딥링크.
 *
 * 카카오T는 외부 앱을 위한 공식 딥링크 API를 공개하지 않는다.
 * 아래 스킴은 갤럭시와 아이폰 실기기에서 각각 확인한 값이다
 * (설계_파장흐름 §6.0 · 설계_웹배포와알림 §B.1).
 */
export const KAKAO_T_SCHEME = 'kakaot://'

export const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.kakao.taxi'
export const APP_STORE = 'https://apps.apple.com/kr/app/id981110422'

export type TaxiLaunchResult =
  /** 카카오T가 열렸다 (네이티브) */
  | 'opened'
  /** 미설치라 스토어로 보냈다 (네이티브) */
  | 'store'
  /** 열지 못했다. 화면의 안내가 유일한 길이 된다 (네이티브) */
  | 'failed'
  /**
   * 시도했고 결과는 모른다 (웹).
   *
   * 브라우저는 "앱이 열렸는지"를 알려주지 않는다. 추측하는 대신
   * 모른다고 인정하고, 화면에서 설치 안내를 항상 보여준다.
   */
  | 'unknown'

export interface UrlOpener {
  openURL: (url: string) => Promise<unknown>
}

export interface LaunchDeps {
  platform?: 'web' | 'native'
  /** 네이티브 경로 */
  opener?: UrlOpener
  /** 웹 경로 — 현재 탭을 그 주소로 보낸다 */
  navigate?: (url: string) => void
  /** 스토어 선택. 생략하면 현재 기기로 판단한다 */
  ios?: boolean
}

/**
 * iOS인지 판단한다.
 *
 * 웹에서는 UA로 본다. iPadOS는 스스로를 Macintosh로 소개하므로
 * 터치 지원 여부까지 봐야 아이패드를 놓치지 않는다.
 */
export function detectIOS(): boolean {
  if (Platform.OS === 'ios') return true
  if (Platform.OS !== 'web') return false
  if (typeof navigator === 'undefined') return false

  const ua = navigator.userAgent ?? ''
  const isIPhone = /iPad|iPhone|iPod/.test(ua)
  const isIPadOS = /Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1
  return isIPhone || isIPadOS
}

/**
 * 미설치 시 보낼 스토어.
 *
 * iOS에서 플레이스토어 링크는 열리기만 하고 설치가 되지 않는다.
 * 반드시 갈라야 한다 (설계_웹배포와알림 §B.2).
 */
export function storeUrl(ios: boolean = detectIOS()): string {
  return ios ? APP_STORE : PLAY_STORE
}

/**
 * 웹에서 카카오T를 띄운다.
 *
 * window.open이 아니라 현재 탭이다. 새 탭으로 열면 팝업 차단에 걸리거나
 * 빈 탭만 뜬다 (설계_웹배포와알림 §B.3).
 *
 * 성공 여부를 판정하지 않는다. 브라우저에는 그 신호가 없고, 추론으로
 * 흉내 내면 틀렸을 때 정상적으로 앱을 연 사람을 스토어로 보내게 된다.
 * 대신 화면이 설치 안내를 항상 보여준다 — 앱이 열린 사람은 이미 떠나서
 * 그 화면을 볼 일이 없고, 안 열린 사람은 눈앞에서 바로 누를 수 있다.
 */
function openOnWeb(navigate: (url: string) => void): TaxiLaunchResult {
  navigate(KAKAO_T_SCHEME)
  return 'unknown'
}

/**
 * 네이티브에서 카카오T를 띄운다. 안 되면 스토어로 보낸다.
 *
 * 여기서는 예외가 진짜 신호다 — 추측이 아니라 자동 폴백이 실제로 동작한다.
 *
 * Linking.canOpenURL을 쓰지 않는다. Android 11+ 패키지 가시성 때문에
 * 매니페스트에 선언하지 않으면 설치돼 있어도 false를 반환한다.
 */
async function openOnNative(opener: UrlOpener, ios: boolean): Promise<TaxiLaunchResult> {
  try {
    await opener.openURL(KAKAO_T_SCHEME)
    return 'opened'
  } catch {
    // 미설치이거나 스킴이 바뀌었다. 스토어로 보낸다.
  }

  try {
    await opener.openURL(storeUrl(ios))
    return 'store'
  } catch {
    return 'failed'
  }
}

/**
 * 카카오T를 띄운다.
 *
 * 절대 throw하지 않는다. 벌칙 연출 도중에 예외가 터지면 화면이 멈춘다.
 */
export async function openKakaoTaxi(deps: LaunchDeps = {}): Promise<TaxiLaunchResult> {
  const platform = deps.platform ?? (Platform.OS === 'web' ? 'web' : 'native')

  if (platform === 'web') {
    const navigate = deps.navigate ?? ((url: string) => {
      window.location.href = url
    })
    return openOnWeb(navigate)
  }
  return openOnNative(deps.opener ?? Linking, deps.ios ?? detectIOS())
}
