import { synth } from '../../sound'
import type { Synth } from '../../sound'

/**
 * 병아리 울음.
 *
 * 공용 어휘(useGameSound)에 넣지 않은 이유는, 그 다섯 개가 열 종이 공유하는
 * "무슨 일이 일어났는지"의 목록이기 때문이다. 삐약은 사건이 아니라 이 게임의
 * 그림에 붙은 소리라서 계란·병아리와 같은 폴더에 둔다.
 *
 * 다만 소리를 내는 것은 공용 synth 그대로다 — 설정의 "효과음 끄기"가
 * 여기에도 그대로 걸리고, 볼륨도 같은 눈금 위에 있다.
 */

/** 삐-약. 올렸다 내리는 두 음이 한 번의 울음이다. */
const CALL = [
  { freq: 2100, durationMs: 70, volume: 0.32 },
  { freq: 2800, durationMs: 60, volume: 0.32 },
  { freq: 1900, durationMs: 90, volume: 0.28 },
]

/** 몇 번 우는가. 한 번이면 삐약"거리는" 느낌이 안 난다. */
const CALLS = 3

export function chirp(s: Synth = synth): void {
  s.sequence(Array.from({ length: CALLS }, () => CALL).flat())
}
