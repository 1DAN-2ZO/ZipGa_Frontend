import {
  BAR_MS,
  BEATS_PER_BAR,
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
  it('바탕음 하나와, 쉼표를 뺀 8분음표들을 낸다', () => {
    const notes = notesForBar(0)
    expect(notes.filter((n) => n.timbre === 'pad')).toHaveLength(1)
    // 마디 끝 한 칸은 비운다. 빽빽하면 리듬이 아니라 소음으로 들린다.
    expect(notes.filter((n) => n.timbre === 'lead')).toHaveLength(STEPS_PER_BAR - 1)
  })

  it('마디 끝에 숨 쉴 자리가 있다', () => {
    const lead = notesForBar(0).filter((n) => n.timbre === 'lead')
    const last = Math.max(...lead.map((n) => n.atBeat))
    expect(last).toBeLessThan(BEATS_PER_BAR - 0.5)
  })

  it('바탕음과 아르페지오의 음색이 다르다', () => {
    // 같은 파형이면 뭉쳐서 한 덩어리로 들린다.
    const kinds = new Set(notesForBar(0).map((n) => n.timbre))
    expect(kinds).toEqual(new Set(['pad', 'lead']))
  })

  it('빠르기가 재촉하는 쪽이다', () => {
    // 96에서 올렸다. 이 앱은 20초짜리 게임이 계속 도는 곳이라 처지면 안 맞는다.
    expect(BPM).toBeGreaterThanOrEqual(140)
  })

  it('뒷박이 밀려서 통통 튄다', () => {
    // 정확히 반박이면 또박또박 기계처럼 간다. 뒤로 밀어야 "쿵-작"이 된다.
    const beats = notesForBar(1)
      .filter((n) => n.timbre === 'lead')
      .map((n) => n.atBeat)
    const offbeats = beats.filter((b) => b % 1 !== 0)
    expect(offbeats.length).toBeGreaterThan(0)
    for (const b of offbeats) expect(b % 1).toBeGreaterThan(0.5)
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

  it('이웃한 마디의 바탕음이 다르다', () => {
    // 같으면 화음이 바뀐 게 안 들려서 같은 마디를 두 번 듣는 것처럼 된다.
    // 진행 전체가 다 달라야 하는 건 아니고, 붙어 있는 것만 달라지면 된다
    // (되감기는 지점 — 마지막 마디와 첫 마디 — 도 이웃이다).
    const roots = [0, 1, 2, 3].map((b) => notesForBar(b)[0].freq)
    for (let i = 0; i < PROGRESSION_BARS; i++) {
      expect(roots[i]).not.toBe(roots[(i + 1) % PROGRESSION_BARS])
    }
  })

  it('모든 마디가 장3화음이다', () => {
    // 장조로 풀리더라도 단조가 섞이면 그 색으로 물들어 처량하게 들린다.
    // 가장 낮은 음에서 재서 0-4-7-12반음이면 장3화음 + 한 옥타브 위 근음이다.
    for (let bar = 0; bar < PROGRESSION_BARS; bar++) {
      const freqs = [
        ...new Set(notesForBar(bar).filter((n) => n.timbre === 'lead').map((n) => n.freq)),
      ].sort((a, b) => a - b)
      const steps = freqs.map((f) => Math.round(12 * Math.log2(f / freqs[0])))
      expect(steps).toEqual([0, 4, 7, 12])
    }
  })

  it('낮은 음과 한 옥타브 위를 번갈아 짚는다', () => {
    // 곧게 오르내리기만 하면 굴러갈 뿐 튀지 않는다. 공이 튀는 모양이어야 한다.
    const lead = notesForBar(0).filter((n) => n.timbre === 'lead')
    const top = Math.max(...lead.map((n) => n.freq))
    const highs = lead.map((n) => n.freq === top)
    // 꼭대기 음이 한 칸 걸러 나온다
    expect(highs.slice(0, 6)).toEqual([false, true, false, true, false, true])
  })

  it('중간 마디부터 시작해도 계산된다', () => {
    // 재생 도중에 들어와도 자리가 맞아야 한다.
    expect(() => notesForBar(1234)).not.toThrow()
    expect(notesForBar(1234)).toHaveLength(1 + (STEPS_PER_BAR - 1))
  })

  it('폰 스피커가 낼 수 있는 음역 안이다', () => {
    // 300Hz 아래는 폰 스피커에서 거의 안 들린다. 바탕음만 그 언저리까지 내려간다.
    for (let bar = 0; bar < PROGRESSION_BARS; bar++) {
      for (const note of notesForBar(bar)) {
        expect(note.freq).toBeGreaterThan(200)
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
