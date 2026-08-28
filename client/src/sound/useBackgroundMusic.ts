import { useEffect } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { suspendAudio } from './audioContext'
import { music } from './index'

/**
 * 지금 배경음이 흘러야 하는가.
 *
 * 'inactive'까지 멈추는 이유는 iOS 때문이다 — 전화가 오거나 앱 전환기를 열면
 * 'background'가 아니라 이 상태를 먼저 거친다. 'active'만 허용하면 그 구간이
 * 자동으로 걸린다.
 */
export function shouldPlayMusic(enabled: boolean, appState: AppStateStatus): boolean {
  return enabled && appState === 'active'
}

/**
 * 배경음을 켜고 끈다.
 *
 * enabled가 참이고 앱이 앞에 있을 때만 흐른다. 화면이 바뀌거나 설정을 끄거나
 * 홈 키를 눌러 나가면 즉시 멎는다.
 *
 * 뒤로 물러날 때 오디오까지 재우는 이유는, 배경음을 멈춰도 이미 예약된 소리가
 * 남아 있기 때문이다(music.ts는 0.7초 앞까지 미리 잡아둔다). 브라우저는 탭이
 * 가려져도 그걸 그대로 내준다.
 *
 * 브라우저 정책상 사용자가 아직 아무것도 안 눌렀으면 소리가 안 난다. 홈 화면에서
 * 가만히 있으면 조용하고, 첫 버튼을 누른 뒤부터 들린다. 막을 방법이 없고 막을
 * 필요도 없다 — 앱을 켜자마자 소리가 나는 편이 오히려 놀란다.
 */
export function useBackgroundMusic(enabled: boolean): void {
  useEffect(() => {
    const sync = (appState: AppStateStatus) => {
      if (shouldPlayMusic(enabled, appState)) {
        music.start()
        return
      }
      music.stop()
      if (appState !== 'active') suspendAudio()
    }

    sync(AppState.currentState)

    // 웹에서는 document.visibilityState가 없으면 구독을 안 걸고 undefined를
    // 돌려준다(react-native-web AppState). 타입에는 안 드러나 있어서 그냥
    // remove()를 부르면 정적 내보내기 같은 DOM 없는 환경에서 터진다.
    const subscription: { remove: () => void } | undefined = AppState.addEventListener(
      'change',
      sync,
    )

    return () => {
      subscription?.remove()
      music.stop()
    }
  }, [enabled])
}
