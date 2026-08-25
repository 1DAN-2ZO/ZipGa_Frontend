import { Linking } from 'react-native'

/**
 * 카카오T 딥링크.
 *
 * 카카오T는 외부 앱을 위한 공식 딥링크 API를 공개하지 않는다.
 * 아래 스킴은 갤럭시 실기기에서 직접 확인한 값이다 (설계 정리 §6.0).
 */
export const KAKAO_T_SCHEME = 'kakaot://'

/** 미설치 시 폴백. 1차 지원 범위가 안드로이드 단독이라 플레이스토어만 둔다. */
export const KAKAO_T_STORE = 'https://play.google.com/store/apps/details?id=com.kakao.taxi'

export type TaxiLaunchResult =
  /** 카카오T가 열렸다 */
  | 'opened'
  /** 미설치라 플레이스토어로 보냈다 */
  | 'store'
  /** 둘 다 열지 못했다. 화면의 수동 탈출구가 유일한 길이 된다 */
  | 'failed'

export interface UrlOpener {
  openURL: (url: string) => Promise<unknown>
}

/**
 * 카카오T를 띄운다. 안 되면 스토어로 보낸다.
 *
 * Linking.canOpenURL을 쓰지 않는다 — Android 11+ 패키지 가시성 때문에
 * 매니페스트에 선언하지 않으면 설치돼 있어도 false를 반환한다.
 * openURL을 그냥 던지고 실패를 잡는 쪽이 견고하다.
 *
 * 절대 throw하지 않는다. 벌칙 연출 도중에 예외가 터지면 화면이 멈춘다.
 */
export async function openKakaoTaxi(opener: UrlOpener = Linking): Promise<TaxiLaunchResult> {
  try {
    await opener.openURL(KAKAO_T_SCHEME)
    return 'opened'
  } catch {
    // 미설치이거나 스킴이 바뀌었다. 스토어로 보낸다.
  }

  try {
    await opener.openURL(KAKAO_T_STORE)
    return 'store'
  } catch {
    return 'failed'
  }
}
