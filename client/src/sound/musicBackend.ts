import { getAudioContext } from './audioContext'
import type { MusicBackend } from './music'
import type { Voice } from './melody'

/**
 * Web Audio로 배경음을 낸다.
 *
 * 오실레이터로 진짜 피아노를 내는 건 무리다. 피아노는 음마다 배음이 조금씩
 * 어긋나 있고 때리는 순간의 소음이 절반인데, 여기서 만들 수 있는 건 배음이
 * 반듯한 소리뿐이다. 그래서 노린 것은 "피아노 흉내"가 아니라 장난감 피아노
 * 쪽이다 — 래그타임으로 들리게 하는 것은 음색이 아니라 왼손과 오른손의
 * 어긋남이고(melody.ts), 그건 제대로 낼 수 있다.
 */

/** 배음 개수. 많을수록 밝지만 폰 스피커에서 쇳소리가 난다. */
const HARMONICS = 12

/**
 * 배음이 줄어드는 기울기.
 *
 * 1이면 톱니파처럼 웅웅거리고, 2면 사인파에 가까워 실로폰이 된다.
 * 그 사이가 건반 소리로 들린다.
 */
const TILT = 1.4

/**
 * 음이 소리 크기를 유지하는 구간.
 *
 * 피아노는 때린 뒤 곧장 잦아든다. 0으로 두면 배음이 있어도 타악기로
 * 들려서, 아주 짧게만 붙잡아 건반을 누른 느낌을 남긴다.
 */
const SUSTAIN = 0.18

let keyboard: PeriodicWave | null = null

/** 배음을 1/n^TILT로 쌓은 파형. 건반 악기의 배음 분포에 가깝다. */
function keyboardWave(audio: AudioContext): PeriodicWave {
  if (keyboard) return keyboard
  const real = new Float32Array(HARMONICS + 1)
  const imag = new Float32Array(HARMONICS + 1)
  for (let n = 1; n <= HARMONICS; n++) {
    real[n] = 1 / Math.pow(n, TILT)
  }
  keyboard = audio.createPeriodicWave(real, imag)
  return keyboard
}

/** 낮은 음일수록 길게 운다. 진짜 피아노가 그렇고, 없으면 왼손이 톡톡 끊긴다. */
function tailFor(voice: Voice): number {
  if (voice === 'bass') return 1.6
  if (voice === 'chord') return 1.0
  return 1.2
}

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
      const seconds = (note.durationMs / 1000) * tailFor(note.voice)

      const osc = audio.createOscillator()
      const gain = audio.createGain()

      osc.setPeriodicWave(keyboardWave(audio))
      osc.frequency.setValueAtTime(note.freq, startAt)

      // 때리고, 잠깐 붙잡고, 잦아든다.
      const attack = Math.min(0.006, seconds * 0.1)
      gain.gain.setValueAtTime(0, startAt)
      gain.gain.linearRampToValueAtTime(note.volume, startAt + attack)
      gain.gain.setValueAtTime(note.volume, startAt + seconds * SUSTAIN)
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
