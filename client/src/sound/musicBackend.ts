import { getAudioContext } from './audioContext'
import type { MusicBackend } from './music'

/**
 * Web Audio로 배경음을 낸다.
 *
 * 효과음(backend.ts)과 다른 점은 둘이다. 예약된 음까지 끊을 수 있어야 하고
 * (끄는 순간 조용해져야 한다), 소리가 부드러워야 한다 — 효과음의 삼각파는
 * 짧게 낼 땐 또렷하지만 계속 깔리면 귀에 거슬린다.
 */
export function createMusicBackend(): MusicBackend | null {
  if (typeof window === 'undefined') return null
  if (!getAudioContext()) return null

  /** 아직 안 끝난 음들. 끌 때 이걸 다 끊는다. */
  const live = new Set<OscillatorNode>()

  return {
    nowSec: () => getAudioContext()?.currentTime ?? 0,

    play(note, delaySec) {
      const audio = getAudioContext()
      if (!audio) return

      const startAt = audio.currentTime + delaySec
      const seconds = note.durationMs / 1000

      const osc = audio.createOscillator()
      const gain = audio.createGain()

      // 사인파. 배경에 깔리는 소리라 배음이 적을수록 앞의 효과음을 안 가린다.
      osc.type = 'sine'
      osc.frequency.setValueAtTime(note.freq, startAt)

      // 효과음보다 훨씬 완만하게 넣고 뺀다. 딸깍거리면 배경음이 아니라
      // 효과음처럼 들려서 자꾸 신경이 그쪽으로 간다.
      const attack = Math.min(0.06, seconds * 0.3)
      gain.gain.setValueAtTime(0, startAt)
      gain.gain.linearRampToValueAtTime(note.volume, startAt + attack)
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + seconds)

      osc.connect(gain).connect(audio.destination)
      osc.start(startAt)
      osc.stop(startAt + seconds + 0.02)

      live.add(osc)
      osc.onended = () => live.delete(osc)
    },

    stopAll() {
      for (const osc of live) {
        try {
          osc.stop()
        } catch {
          // 이미 끝난 것을 또 끊으면 예외가 난다. 무시해도 되는 경우다.
        }
      }
      live.clear()
    },
  }
}
