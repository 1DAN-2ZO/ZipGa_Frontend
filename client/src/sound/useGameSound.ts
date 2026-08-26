import { useMemo } from 'react'
import { synth } from './index'
import type { Synth } from './synth'

/**
 * 미니게임이 쓰는 소리 어휘.
 *
 * 게임은 "무슨 일이 일어났는지"만 알리고 실제 소리는 앱이 정한다.
 * 다섯 개면 10종을 전부 덮으므로 담당자가 고민할 게 없고,
 * 나중에 밸런스를 잡을 때 한 곳만 고치면 전부 반영된다.
 */
export interface GameSound {
  /** 잘한 것 — 정답 · 명중 · 획득 */
  hit: () => void
  /** 못한 것 — 오답 · 놓침 · 피격 */
  miss: () => void
  /** 치면 안 되는 걸 건드림 — 폭탄 · 함정 */
  penalty: () => void
  /** 중립 동작 — 연타 · 카드 뒤집기 · 타자 */
  tick: () => void
  /** 완주 · 목표 달성 */
  finish: () => void
}

/** 연타 게임이 초당 7번 부른다. 매번 노드를 만들면 부하가 걸린다. */
const TAP_COOLDOWN_MS = 40
const EVENT_COOLDOWN_MS = 60

export function createGameSound(s: Synth = synth): GameSound {
  return {
    hit: () => s.tone(880, 70, 0.35, { key: 'hit', cooldownMs: EVENT_COOLDOWN_MS }),
    miss: () => s.tone(196, 130, 0.3, { key: 'miss', cooldownMs: EVENT_COOLDOWN_MS }),
    penalty: () =>
      s.sequence([
        { freq: 160, durationMs: 90, volume: 0.45 },
        { freq: 110, durationMs: 160, volume: 0.45 },
      ]),
    tick: () => s.tone(660, 30, 0.18, { key: 'tick', cooldownMs: TAP_COOLDOWN_MS }),
    finish: () =>
      s.sequence([
        { freq: 660, durationMs: 90 },
        { freq: 880, durationMs: 90 },
        { freq: 1320, durationMs: 180 },
      ]),
  }
}

export function useGameSound(): GameSound {
  return useMemo(() => createGameSound(), [])
}
