import {
  BAR_MS,
  BPM,
  midiToFreq,
  notesForBar,
  PROGRESSION_BARS,
  STEPS_PER_BAR,
  SUBDIVISION,
} from '../melody'

describe('midiToFreq', () => {
  it('A4는 440Hz다', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 6)
  })

  it('한 옥타브 위는 두 배다', () => {
    expect(midiToFreq(81)).toBeCloseTo(880, 6)
  })
})

describe('notesForBar', () => {
  it('바탕음 하나와 8분음표마다의 음을 낸다', () => {
    expect(notesForBar(0)).toHaveLength(1 + STEPS_PER_BAR)
  })

  it('빠르기가 재촉하는 쪽이다', () => {
    // 96에서 올렸다. 이 앱은 20초짜리 게임이 계속 도는 곳이라 처지면 안 맞는다.
    expect(BPM).toBeGreaterThanOrEqual(140)
  })

  it('음이 마디 안에 고르게 박힌다', () => {
    const beats = notesForBar(1).slice(1).map((n) => n.atBeat)
    expect(beats).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5])
  })

  it('마디 안에 센 박이 있다', () => {
    // 세기가 다 같으면 빠르기만 하고 신나지는 않는다.
    const volumes = notesForBar(0).slice(1).map((n) => n.volume)
    expect(Math.max(...volumes)).toBeGreaterThan(Math.min(...volumes) * 1.5)
  })

  it('바탕음은 마디 내내 이어진다', () => {
    const [pad] = notesForBar(0)
    expect(pad.atBeat).toBe(0)
    expect(pad.durationMs).toBe(BAR_MS)
  })

  it('음을 짧게 끊는다', () => {
    // 이어 붙이면 같은 빠르기여도 늘어져 들린다. 끊어야 몰아친다.
    const stepMs = BAR_MS / STEPS_PER_BAR
    for (const note of notesForBar(2).slice(1)) {
      expect(note.durationMs).toBeLessThan(stepMs * 0.8)
    }
    expect(SUBDIVISION).toBe(2)
  })

  it('네 마디마다 같은 화음으로 돌아온다', () => {
    expect(notesForBar(PROGRESSION_BARS)).toEqual(notesForBar(0))
    expect(notesForBar(PROGRESSION_BARS * 3 + 2)).toEqual(notesForBar(2))
  })

  it('네 마디의 바탕음이 서로 다르다', () => {
    // 겹치면 화음이 바뀐 게 안 들려서 같은 마디를 두 번 듣는 것처럼 된다.
    const roots = [0, 1, 2, 3].map((b) => notesForBar(b)[0].freq)
    expect(new Set(roots).size).toBe(PROGRESSION_BARS)
  })

  it('중간 마디부터 시작해도 계산된다', () => {
    // 재생 도중에 들어와도 자리가 맞아야 한다.
    expect(() => notesForBar(1234)).not.toThrow()
    expect(notesForBar(1234)).toHaveLength(1 + STEPS_PER_BAR)
  })

  it('폰 스피커가 낼 수 있는 음역 안이다', () => {
    // 300Hz 아래는 폰 스피커에서 거의 안 들린다. 바탕음만 그 언저리까지 내려간다.
    for (let bar = 0; bar < PROGRESSION_BARS; bar++) {
      for (const note of notesForBar(bar)) {
        expect(note.freq).toBeGreaterThan(200)
        expect(note.freq).toBeLessThan(1000)
      }
    }
  })

  it('효과음보다 확실히 작다', () => {
    // 배경음이 게임 소리를 덮으면 안 된다. 가장 조용한 효과음(tick)이 0.18이다.
    for (let bar = 0; bar < PROGRESSION_BARS; bar++) {
      for (const note of notesForBar(bar)) {
        expect(note.volume).toBeLessThan(0.18)
      }
    }
  })
})
