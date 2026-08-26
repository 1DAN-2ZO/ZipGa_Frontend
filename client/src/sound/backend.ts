import type { AudioBackend } from './synth'

/**
 * Web Audio로 짧은 톤을 낸다.
 *
 * 브라우저는 사용자 제스처 전에 오디오를 열어주지 않는다. 그래서 생성만
 * 해두고 실제 열기는 첫 소리 시점으로 미룬다 — 그 시점이면 사용자가
 * 이미 버튼을 눌렀을 가능성이 높다.
 */
export function createWebAudioBackend(): AudioBackend | null {
  if (typeof window === 'undefined') return null

  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctor) return null

  let ctx: AudioContext | null = null

  const ensure = (): AudioContext | null => {
    try {
      ctx ??= new Ctor()
      // 자동재생 정책으로 정지돼 있으면 깨운다.
      if (ctx.state === 'suspended') void ctx.resume()
      return ctx
    } catch {
      return null
    }
  }

  return {
    nowMs: () => Date.now(),

    tone(freq, durationMs, volume, delayMs) {
      const audio = ensure()
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
