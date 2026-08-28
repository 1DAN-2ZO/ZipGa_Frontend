import { useEffect } from 'react'
import { music } from './index'

/**
 * 배경음을 켜고 끈다.
 *
 * playing이 참인 동안만 흐른다. 화면이 바뀌거나 설정을 끄면 즉시 멎는다.
 *
 * 브라우저 정책상 사용자가 아직 아무것도 안 눌렀으면 소리가 안 난다.
 * 홈 화면에서 가만히 있으면 조용하고, 첫 버튼을 누른 뒤부터 들린다.
 * 막을 방법이 없고 막을 필요도 없다 — 앱을 켜자마자 소리가 나는 편이
 * 오히려 놀란다.
 */
export function useBackgroundMusic(playing: boolean): void {
  useEffect(() => {
    if (!playing) return
    music.start()
    return () => music.stop()
  }, [playing])
}
