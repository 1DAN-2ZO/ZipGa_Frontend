import { getAudioContext } from './audioContext'
import type { MusicBackend } from './music'
import type { Timbre } from './melody'

/**
 * Web Audio로 배경음을 낸다.
 *
 * 효과음(backend.ts)과 다른 점은 셋이다. 예약된 음까지 끊을 수 있어야 하고
 * (끄는 순간 조용해져야 한다), 악기가 달라야 하며(효과음은 삼각파다),
 * 앞의 소리를 안 가릴 만큼 작아야 한다.
 */

/**
 * 펄스파의 듀티비.
 *
 * 처음엔 사인파를 썼는데 실로폰 소리가 났다 — 배음 없는 파형에 즉시 꺼지는
 * 포락선을 붙이면 그게 곧 말렛 악기다. 한쪽으로 치우친 사각파는 홀·짝 배음이
 * 다 살아 있어 리드 악기처럼 들린다. 게임기 소리의 그 음색이다.
 */
const DUTY = 0.3

/** 살릴 배음 수. 많을수록 밝지만 폰 스피커에서 쇳소리가 난다. */
const HARMONICS = 14

/**
 * 음이 소리 크기를 유지하는 구간.
 *
 * 0이면 치자마자 잦아들어 말렛이 되고, 1에 가까우면 오르간이 된다.
 * 중간쯤이라 튕기는 느낌은 남으면서 실로폰으로는 안 들린다.
 */
const SUSTAIN = 0.6

let pulse: PeriodicWave | null = null

/**
 * 듀티비 DUTY인 펄스파를 만든다.
 *
 * 사각파를 푸리에로 펼치면 n번째 배음의 크기가 (2/nπ)·sin(nπd)이다.
 * 뒤로 갈수록 조금씩 깎아 고음이 날카롭지 않게 다듬는다.
 */
function pulseWave(audio: AudioContext): PeriodicWave {
  if (pulse) return pulse
  const real = new Float32Array(HARMONICS + 1)
  const imag = new Float32Array(HARMONICS + 1)
  for (let n = 1; n <= HARMONICS; n++) {
    const rolloff = 1 - (n - 1) / HARMONICS
    real[n] = ((2 / (n * Math.PI)) * Math.sin(n * Math.PI * DUTY)) * rolloff
  }
  pulse = audio.createPeriodicWave(real, imag)
  return pulse
}

function voice(audio: AudioContext, osc: OscillatorNode, timbre: Timbre): void {
  if (timbre === 'pad') {
    // 바탕음은 부드러운 삼각파. 앞의 리드와 뭉치지 않는다.
    osc.type = 'triangle'
    return
  }
  osc.setPeriodicWave(pulseWave(audio))
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
      const seconds = note.durationMs / 1000

      const osc = audio.createOscillator()
      const gain = audio.createGain()

      voice(audio, osc, note.timbre)
      osc.frequency.setValueAtTime(note.freq, startAt)

      // 빠르게 넣고, 유지하다, 끝에서 뺀다. 유지 구간이 없으면 실로폰이 된다.
      const attack = Math.min(0.012, seconds * 0.2)
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
