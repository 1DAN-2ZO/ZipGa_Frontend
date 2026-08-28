import {
  BAR_MS,
  BEAT_MS,
  BEATS_PER_BAR,
  midiToFreq,
  notesForBar,
  PROGRESSION_BARS,
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
  it('바탕음 하나와 박자마다의 음을 낸다', () => {
    expect(notesForBar(0)).toHaveLength(1 + BEATS_PER_BAR)
  })

  it('바탕음은 마디 내내 이어진다', () => {
    const [pad] = notesForBar(0)
    expect(pad.atBeat).toBe(0)
    expect(pad.durationMs).toBe(BAR_MS)
  })

  it('음이 다음 박을 넘지 않는다', () => {
    // 넘으면 겹쳐서 뭉개지고 화음이 흐려진다.
    for (const note of notesForBar(2).slice(1)) {
      expect(note.durationMs).toBeLessThan(BEAT_MS)
    }
  })

  it('네 마디마다 같은 화음으로 돌아온다', () => {
    expect(notesForBar(PROGRESSION_BARS)).toEqual(notesForBar(0))
    expect(notesForBar(PROGRESSION_BARS * 3 + 2)).toEqual(notesForBar(2))
  })

  it('네 마디가 서로 다른 화음이다', () => {
    const roots = [0, 1, 2, 3].map((b) => notesForBar(b)[0].freq)
    expect(new Set(roots).size).toBe(PROGRESSION_BARS)
  })

  it('중간 마디부터 시작해도 계산된다', () => {
    // 재생 도중에 들어와도 자리가 맞아야 한다.
    expect(() => notesForBar(1234)).not.toThrow()
    expect(notesForBar(1234)).toHaveLength(1 + BEATS_PER_BAR)
  })

  it('폰 스피커가 낼 수 있는 음역 안이다', () => {
    // 300Hz 아래는 폰 스피커에서 거의 안 들린다. 바탕음만 그 언저리까지 내려간다.
    for (let bar = 0; bar < PROGRESSION_BARS; bar++) {
      for (const note of notesForBar(bar)) {
        expect(note.freq).toBeGreaterThan(150)
        expect(note.freq).toBeLessThan(1200)
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
