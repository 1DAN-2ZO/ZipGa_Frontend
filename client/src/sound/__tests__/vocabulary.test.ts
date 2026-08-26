import { createAppSound } from '../useAppSound'
import { createGameSound } from '../useGameSound'
import type { Note, Synth, ToneOptions } from '../synth'

/** 어떤 소리를 냈는지만 기록하는 가짜 신디사이저. */
function fakeSynth() {
  const tones: Array<{ freq: number; options?: ToneOptions }> = []
  const sequences: Note[][] = []
  const synth: Synth = {
    tone: (freq, _d, _v, options) => tones.push({ freq, options }),
    sequence: (notes) => sequences.push(notes),
    setEnabled: () => {},
  }
  return { synth, tones, sequences }
}

describe('게임 어휘', () => {
  it('다섯 개를 모두 제공한다', () => {
    // 담당자가 고를 어휘가 늘면 게임마다 제각각이 된다.
    expect(Object.keys(createGameSound(fakeSynth().synth)).sort()).toEqual([
      'finish',
      'hit',
      'miss',
      'penalty',
      'tick',
    ])
  })

  it('전부 소리를 낸다', () => {
    const { synth, tones, sequences } = fakeSynth()
    const sound = createGameSound(synth)
    sound.hit()
    sound.miss()
    sound.penalty()
    sound.tick()
    sound.finish()
    expect(tones.length + sequences.length).toBe(5)
  })

  it('연타용 tick에는 쿨다운이 걸려 있다', () => {
    const { synth, tones } = fakeSynth()
    createGameSound(synth).tick()
    expect(tones[0].options?.cooldownMs).toBeGreaterThan(0)
  })

  it('hit이 miss보다 높은 음이다', () => {
    // 높은 음은 성공, 낮은 음은 실패로 들린다.
    const { synth, tones } = fakeSynth()
    const sound = createGameSound(synth)
    sound.hit()
    sound.miss()
    expect(tones[0].freq).toBeGreaterThan(tones[1].freq)
  })

  it('finish는 올라가는 음이다', () => {
    const { synth, sequences } = fakeSynth()
    createGameSound(synth).finish()
    const freqs = sequences[0].map((n) => n.freq)
    expect(freqs).toEqual([...freqs].sort((a, b) => a - b))
  })

  it('penalty는 내려가는 음이다', () => {
    const { synth, sequences } = fakeSynth()
    createGameSound(synth).penalty()
    const freqs = sequences[0].map((n) => n.freq)
    expect(freqs).toEqual([...freqs].sort((a, b) => b - a))
  })
})

describe('앱 어휘', () => {
  it('세션 시작음이 가장 크다', () => {
    // 술집 소음을 뚫어야 한다. 이걸 못 들으면 판이 지나가고 0점이 된다.
    const { synth, sequences } = fakeSynth()
    const sound = createAppSound(synth)
    sound.sessionStart()
    sound.playerJoin()

    const loudest = (notes: Note[]) => Math.max(...notes.map((n) => n.volume ?? 0))
    expect(loudest(sequences[0])).toBeGreaterThan(loudest(sequences[1]))
  })

  it('벌칙음은 내려가는 음이다', () => {
    // 올라가는 소리는 축하로 들린다.
    const { synth, sequences } = fakeSynth()
    createAppSound(synth).penalized()
    const freqs = sequences[0].map((n) => n.freq)
    expect(freqs).toEqual([...freqs].sort((a, b) => b - a))
  })

  it('생존음은 올라가는 음이다', () => {
    const { synth, sequences } = fakeSynth()
    createAppSound(synth).survived()
    const freqs = sequences[0].map((n) => n.freq)
    expect(freqs).toEqual([...freqs].sort((a, b) => a - b))
  })

  it('카운트다운 틱은 1초 안에 겹쳐 나지 않는다', () => {
    const { synth, tones } = fakeSynth()
    createAppSound(synth).countdownTick()
    expect(tones[0].options?.cooldownMs).toBeGreaterThan(0)
  })
})
