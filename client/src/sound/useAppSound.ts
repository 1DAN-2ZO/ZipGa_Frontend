import { useMemo } from 'react'
import { synth } from './index'
import type { Synth } from './synth'

/**
 * 게임 밖에서 나는 소리.
 *
 * sessionStart가 이 목록에서 가장 중요하다. 이걸 못 들으면 판이 그냥
 * 지나가고 3판 평균 0점으로 강퇴된다 — 편의가 아니라 공정성 문제다
 * (webDistribution.md §1.2).
 */
export interface AppSound {
  /** 다른 사람이 방에 들어옴 */
  playerJoin: () => void
  /** 주기가 차서 "게임할 시간!" 배지가 뜸 */
  sessionReady: () => void
  /** 방장이 시작을 눌렀다 — 지금 화면을 봐야 한다 */
  sessionStart: () => void
  /** 3 · 2 · 1 각 틱 */
  countdownTick: () => void
  /** 카운트다운 끝, 게임 시작 */
  go: () => void
  /** 내가 기준선을 넘겼다 */
  survived: () => void
  /** 내가 기준선 미달 — 집에 간다 */
  penalized: () => void
}

export function createAppSound(s: Synth = synth): AppSound {
  return {
    playerJoin: () =>
      s.sequence([
        { freq: 523, durationMs: 70, volume: 0.25 },
        { freq: 784, durationMs: 90, volume: 0.25 },
      ]),

    sessionReady: () =>
      s.sequence([
        { freq: 784, durationMs: 100 },
        { freq: 784, durationMs: 100 },
      ]),

    // 술집 소음을 뚫어야 하므로 이 소리만 길고 크게 간다.
    sessionStart: () =>
      s.sequence([
        { freq: 659, durationMs: 120, volume: 0.5 },
        { freq: 880, durationMs: 120, volume: 0.5 },
        { freq: 1047, durationMs: 260, volume: 0.5 },
      ]),

    countdownTick: () => s.tone(440, 90, 0.35, { key: 'tick3', cooldownMs: 200 }),
    go: () => s.tone(1047, 220, 0.5),

    survived: () =>
      s.sequence([
        { freq: 784, durationMs: 110 },
        { freq: 1047, durationMs: 200 },
      ]),

    // 내려가는 음. 올라가는 소리는 축하로 들린다.
    penalized: () =>
      s.sequence([
        { freq: 392, durationMs: 140, volume: 0.45 },
        { freq: 294, durationMs: 140, volume: 0.45 },
        { freq: 196, durationMs: 320, volume: 0.45 },
      ]),
  }
}

export function useAppSound(): AppSound {
  return useMemo(() => createAppSound(), [])
}
