import {
  BAR_MS,
  BEAT_MS,
  BEATS_PER_BAR,
  BPM,
  midiToFreq,
  notesForBar,
  PROGRESSION_BARS,
} from '../melody'

const at = (bar: number, voice: string) => notesForBar(bar).filter((n) => n.voice === voice)

describe('midiToFreq', () => {
  it('A4는 440Hz다', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 6)
  })

  it('한 옥타브 위는 두 배다', () => {
    expect(midiToFreq(81)).toBeCloseTo(880, 6)
  })
})

describe('왼손 — 쿵짝', () => {
  it('베이스가 1·3박을 짚는다', () => {
    expect(at(0, 'bass').map((n) => n.atBeat)).toEqual([0, 2])
  })

  it('화음이 2·4박에 들어간다', () => {
    // 베이스와 엇갈려야 "쿵-짝 쿵-짝"이 된다. 같은 박에 겹치면 그냥 쿵쿵이다.
    expect(new Set(at(0, 'chord').map((n) => n.atBeat))).toEqual(new Set([1, 3]))
  })

  it('2·4박 화음은 세 음을 같이 던진다', () => {
    expect(at(0, 'chord')).toHaveLength(6)
  })

  it('화음은 짧게 던지고 베이스는 길게 운다', () => {
    // 화음이 길면 "짝"이 아니라 깔리는 소리가 되고, 베이스가 짧으면 바닥이 사라진다.
    expect(at(0, 'chord')[0].durationMs).toBeLessThan(at(0, 'bass')[0].durationMs)
  })

  it('1박과 3박의 베이스가 다르다', () => {
    // 같은 음을 두 번 치면 제자리걸음으로 들린다.
    const [first, second] = at(0, 'bass')
    expect(first.freq).not.toBeCloseTo(second.freq, 3)
  })
})

describe('오른손 — 당김음', () => {
  it('박 사이로 비껴 들어간다', () => {
    // 래그타임의 정체는 이 어긋남이다. 왼손이 짚는 정박에만 있으면 행진곡이다.
    const beats = at(0, 'melody').map((n) => n.atBeat)
    expect(beats.some((b) => b % 1 !== 0)).toBe(true)
  })

  it('왼손이 쉬는 자리를 메운다', () => {
    // 오른손이 왼손과 같은 자리만 짚으면 어긋남이 안 들린다.
    const left = new Set([...at(0, 'bass'), ...at(0, 'chord')].map((n) => n.atBeat))
    const offGrid = at(0, 'melody').filter((n) => !left.has(n.atBeat))
    expect(offGrid.length).toBeGreaterThanOrEqual(3)
  })

  it('16분음표 격자 위에 있다', () => {
    // 격자를 벗어나면 어긋남이 아니라 어설프게 어긋난 소리가 된다.
    for (const n of at(0, 'melody')) {
      expect((n.atBeat * 4) % 1).toBe(0)
    }
  })

  it('마디 안에 다 들어간다', () => {
    for (const n of notesForBar(0)) {
      expect(n.atBeat).toBeGreaterThanOrEqual(0)
      expect(n.atBeat).toBeLessThan(BEATS_PER_BAR)
    }
  })
})

describe('화음 진행', () => {
  it('네 마디마다 돌아온다', () => {
    expect(notesForBar(PROGRESSION_BARS)).toEqual(notesForBar(0))
    expect(notesForBar(PROGRESSION_BARS * 3 + 2)).toEqual(notesForBar(2))
  })

  it('이웃한 마디의 베이스가 다르다', () => {
    // 같으면 화음이 바뀐 게 안 들려서 같은 마디를 두 번 듣는 것처럼 된다.
    // 되감기는 지점(마지막 마디 → 첫 마디)도 이웃이다.
    const roots = [0, 1, 2, 3].map((b) => at(b, 'bass')[0].freq)
    for (let i = 0; i < PROGRESSION_BARS; i++) {
      expect(roots[i]).not.toBeCloseTo(roots[(i + 1) % PROGRESSION_BARS], 3)
    }
  })

  it('모든 마디가 장3화음이다', () => {
    // 장조로 풀리더라도 단조가 섞이면 그 색으로 물들어 처량하게 들린다.
    // 가장 낮은 음에서 재서 0-4-7-12반음이면 장3화음 + 한 옥타브 위 근음이다.
    for (let bar = 0; bar < PROGRESSION_BARS; bar++) {
      const freqs = [...new Set(at(bar, 'melody').map((n) => n.freq))].sort((a, b) => a - b)
      expect(freqs.map((f) => Math.round(12 * Math.log2(f / freqs[0])))).toEqual([0, 4, 7, 12])
    }
  })

  it('중간 마디부터 시작해도 계산된다', () => {
    // 재생 도중에 들어와도 자리가 맞아야 한다.
    expect(notesForBar(1234)).toEqual(notesForBar(1234 % PROGRESSION_BARS))
  })
})

describe('폰 스피커와 게임 소리', () => {
  it('빠르기가 재촉하는 쪽이다', () => {
    expect(BPM).toBeGreaterThanOrEqual(140)
  })

  it('한 마디가 네 박이다', () => {
    expect(BAR_MS).toBeCloseTo(BEAT_MS * BEATS_PER_BAR, 6)
  })

  it('폰 스피커가 낼 수 있는 음역 안이다', () => {
    // 폰 스피커는 낮은 음을 거의 못 낸다. 진짜 피아노 왼손 음역을 쓰면
    // 쿵짝의 "쿵"이 통째로 사라진다.
    for (let bar = 0; bar < PROGRESSION_BARS; bar++) {
      for (const n of notesForBar(bar)) {
        expect(n.freq).toBeGreaterThan(180)
        expect(n.freq).toBeLessThan(1400)
      }
    }
  })

  it('효과음보다 확실히 작다', () => {
    // 배경음이 게임 소리를 덮으면 안 된다. 가장 조용한 효과음(tick)이 0.18이다.
    for (let bar = 0; bar < PROGRESSION_BARS; bar++) {
      for (const n of notesForBar(bar)) {
        expect(n.volume).toBeLessThan(0.12)
      }
    }
  })

  it('한 순간에 겹치는 소리가 지나치지 않다', () => {
    // 다 합쳐 1을 넘으면 소리가 찢어진다.
    for (let bar = 0; bar < PROGRESSION_BARS; bar++) {
      const byBeat = new Map<number, number>()
      for (const n of notesForBar(bar)) {
        byBeat.set(n.atBeat, (byBeat.get(n.atBeat) ?? 0) + n.volume)
      }
      for (const sum of byBeat.values()) expect(sum).toBeLessThan(0.35)
    }
  })
})
