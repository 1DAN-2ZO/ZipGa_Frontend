import { getAudioContext } from './audioContext'
import type { AudioBackend } from './synth'

/**
 * Web Audio로 짧은 톤을 낸다.
 *
 * AudioContext는 배경음(music.ts)과 같은 것을 쓴다 — audioContext.ts가
 * 열기와 깨우기를 맡는다.
 */
export function createWebAudioBackend(): AudioBackend | null {
  if (typeof window === 'undefined') return null
  if (!getAudioContext()) return null

  return {
    nowMs: () => Date.now(),

    tone(freq, durationMs, volume, delayMs) {
      const audio = getAudioContext()
      if (!audio) return

      const startAt = audio.currentTime + delayMs / 1000
      const seconds = durationMs / 1000

      const osc = audio.createOscillator()
      const gain = audio.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, startAt)

      // 딸깍 소리를 막으려면 0에서 시작해 0으로 끝나야 한다.
      gain.gain.setValueAtTime(0, startAt)
      gain.gain.linearRampToValueAtTime(volume, startAt + 0.008)
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + seconds)

      osc.connect(gain).connect(audio.destination)
      osc.start(startAt)
      osc.stop(startAt + seconds + 0.02)
    },
  }
}
