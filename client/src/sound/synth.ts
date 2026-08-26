/**
 * 짧은 효과음을 코드로 합성한다.
 *
 * 음원 파일을 쓰지 않는 이유는 셋이다 — 웹 배포에서 용량이 곧 진입 속도이고,
 * 라이선스를 따질 필요가 없으며, 재생 지연이 없다.
 * 배경음처럼 긴 곡은 이 방식이 단조롭지만 효과음은 오히려 유리하다.
 */

export interface Note {
  freq: number
  durationMs: number
  /** 0~1. 생략하면 기본값 */
  volume?: number
}

export interface ToneOptions {
  /** 같은 key로 이 시간 안에 다시 부르면 무시한다 */
  cooldownMs?: number
  /** 쿨다운을 구분하는 이름. 생략하면 쿨다운 없음 */
  key?: string
}

/** 실제로 소리를 내는 쪽. 테스트에서 갈아끼운다. */
export interface AudioBackend {
  nowMs: () => number
  /** delayMs 뒤에 낸다. 0이면 즉시. */
  tone: (freq: number, durationMs: number, volume: number, delayMs: number) => void
}

export interface Synth {
  tone: (freq: number, durationMs: number, volume?: number, options?: ToneOptions) => void
  /** 음을 이어서 낸다 */
  sequence: (notes: Note[]) => void
  setEnabled: (enabled: boolean) => void
}

const DEFAULT_VOLUME = 0.4

/** 음 사이 간격. 붙여 내면 뭉개진다. */
const SEQUENCE_GAP_MS = 20

/**
 * 백엔드가 null이면 조용히 아무 일도 하지 않는다.
 *
 * 테스트 환경에는 AudioContext가 없고, 브라우저도 사용자 제스처 전에는
 * 오디오를 열어주지 않는다. 그때마다 예외가 터지면 게임이 멈춘다.
 */
export function createSynth(backend: AudioBackend | null): Synth {
  let enabled = true
  const lastPlayedAt = new Map<string, number>()

  const canPlay = (options?: ToneOptions): boolean => {
    if (!enabled || backend === null) return false
    if (!options?.key || options.cooldownMs === undefined) return true

    const now = backend.nowMs()
    const last = lastPlayedAt.get(options.key)
    if (last !== undefined && now - last < options.cooldownMs) return false

    lastPlayedAt.set(options.key, now)
    return true
  }

  return {
    tone(freq, durationMs, volume = DEFAULT_VOLUME, options) {
      if (!canPlay(options)) return
      backend!.tone(freq, durationMs, volume, 0)
    },

    sequence(notes) {
      if (!enabled || backend === null) return
      // 음을 순서대로 낸다. 지연을 안 주면 화음이 되어 멜로디가 사라진다.
      let delayMs = 0
      for (const note of notes) {
        backend.tone(note.freq, note.durationMs, note.volume ?? DEFAULT_VOLUME, delayMs)
        delayMs += note.durationMs + SEQUENCE_GAP_MS
      }
    },

    setEnabled(next) {
      enabled = next
    },
  }
}
