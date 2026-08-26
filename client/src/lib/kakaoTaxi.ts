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

/** 웹에서 "앱이 열렸나"를 판단하기까지 기다리는 시간. */
const DETECT_MS = 1500

export type TaxiLaunchResult =
  /** 카카오T가 열린 것으로 판단 */
  | 'opened'
  /** 미설치라 스토어로 보냈다 (네이티브만) */
  | 'store'
  /** 열지 못했다. 화면의 수동 탈출구가 유일한 길이 된다 */
  | 'failed'

export interface UrlOpener {
  openURL: (url: string) => Promise<unknown>
}

/** 웹에서 필요한 브라우저 동작. 테스트에서 갈아끼우기 위해 좁게 잡았다. */
export interface WebDeps {
  /** 현재 탭을 그 주소로 보낸다 */
  navigate: (url: string) => void
  /** 페이지가 숨겨졌는지 */
  isHidden: () => boolean
  /** visibilitychange 구독. 해제 함수를 돌려준다 */
  onVisibilityChange: (cb: () => void) => () => void
  /** ms 뒤 실행. 취소 함수를 돌려준다 */
  delay: (ms: number, cb: () => void) => () => void
}

export interface LaunchDeps {
  platform?: 'web' | 'native'
  /** 네이티브 경로 */
  opener?: UrlOpener
  /** 웹 경로 */
  web?: WebDeps
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

const browserDeps: WebDeps = {
  navigate: (url) => {
    // window.open이 아니라 현재 탭이다. 새 탭으로 열면 팝업 차단에 걸리거나
    // 빈 탭만 뜬다 (설계_웹배포와알림 §B.3).
    window.location.href = url
  },
  isHidden: () => document.hidden,
  onVisibilityChange: (cb) => {
    document.addEventListener('visibilitychange', cb)
    return () => document.removeEventListener('visibilitychange', cb)
  },
  delay: (ms, cb) => {
    const id = setTimeout(cb, ms)
    return () => clearTimeout(id)
  },
}

/**
 * 웹에서 카카오T를 띄운다.
 *
 * 웹에는 "앱이 안 열렸다"는 신호가 없다. 브라우저가 알려주지 않는다.
 * 그래서 "페이지가 백그라운드로 내려갔다 = 앱이 열렸다"를 신호로 삼아 추론한다.
 *
 * 실패해도 스토어로 자동 이동시키지 않는다. 현재 탭을 덮으면 앱이 통째로
 * 사라지고, 감지가 틀렸을 때 정상적으로 앱을 연 사람이 돌아와서 스토어를
 * 보게 된다. 화면의 수동 탈출구로 넘기는 편이 안전하다.
 */
function openOnWeb(web: WebDeps): Promise<TaxiLaunchResult> {
  return new Promise((resolve) => {
    let settled = false
    let unsubscribe: (() => void) | null = null
    let cancelTimer: (() => void) | null = null

    const finish = (result: TaxiLaunchResult) => {
      if (settled) return
      settled = true
      unsubscribe?.()
      cancelTimer?.()
      unsubscribe = null
      cancelTimer = null
      resolve(result)
    }

    unsubscribe = web.onVisibilityChange(() => {
      if (web.isHidden()) finish('opened')
    })
    cancelTimer = web.delay(DETECT_MS, () => finish('failed'))

    web.navigate(KAKAO_T_SCHEME)
  })
}

/**
 * 네이티브에서 카카오T를 띄운다. 안 되면 스토어로 보낸다.
 *
 * Linking.canOpenURL을 쓰지 않는다 — Android 11+ 패키지 가시성 때문에
 * 매니페스트에 선언하지 않으면 설치돼 있어도 false를 반환한다.
 * openURL을 그냥 던지고 실패를 잡는 쪽이 견고하다.
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
    return openOnWeb(deps.web ?? browserDeps)
  }
  return openOnNative(deps.opener ?? Linking, deps.ios ?? detectIOS())
}
