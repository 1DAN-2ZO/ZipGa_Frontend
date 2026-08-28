import { BAR_MS, notesForBar } from '../melody'
import { createMusic, SCHEDULE_AHEAD_SEC, type MusicBackend, type Ticker } from '../music'

function fakes() {
  let now = 100
  const played: Array<{ freq: number; atSec: number }> = []
  let stopAllCount = 0
  const backend: MusicBackend = {
    nowSec: () => now,
    play: (note, delaySec) => played.push({ freq: note.freq, atSec: now + delaySec }),
    stopAll: () => {
      stopAllCount += 1
    },
  }

  let tick: (() => void) | null = null
  const ticker: Ticker = {
    every: (_ms, fn) => {
      tick = fn
      return 'handle'
    },
    cancel: () => {
      tick = null
    },
  }

  return {
    backend,
    ticker,
    played,
    advance: (sec: number) => {
      now += sec
      tick?.()
    },
    get running() {
      return tick !== null
    },
    get stopAllCount() {
      return stopAllCount
    },
  }
}

describe('createMusic', () => {
  it('시작하면 앞쪽 마디를 미리 예약한다', () => {
    const f = fakes()
    createMusic(f.backend, f.ticker).start()

    expect(f.played.length).toBeGreaterThan(0)
    // 예약 구간을 크게 넘어서까지 잡아두지 않는다 — 그러면 끌 때 안 멈춘다.
    for (const p of f.played) {
      expect(p.atSec).toBeLessThan(100 + SCHEDULE_AHEAD_SEC + BAR_MS / 1000)
    }
  })

  it('시간이 흐르면 다음 마디를 이어서 예약한다', () => {
    const f = fakes()
    createMusic(f.backend, f.ticker).start()
    const first = f.played.length

    f.advance(BAR_MS / 1000)
    expect(f.played.length).toBeGreaterThan(first)
  })

  it('예약이 끊기지 않고 이어진다', () => {
    const f = fakes()
    createMusic(f.backend, f.ticker).start()
    for (let i = 0; i < 12; i++) f.advance(0.25)

    // 마디 하나가 통째로 빠지면 소리가 끊긴다.
    const times = f.played.map((p) => p.atSec).sort((a, b) => a - b)
    for (let i = 1; i < times.length; i++) {
      expect(times[i] - times[i - 1]).toBeLessThanOrEqual(BAR_MS / 1000)
    }
  })

  it('오래 멈췄다 깨어나도 밀린 마디를 쏟아붓지 않는다', () => {
    // 탭을 다른 데 뒀다 돌아오면 타이머가 한참 만에 깬다. 그동안의 마디를
    // 전부 지금 내면 화음이 뭉개진다.
    const f = fakes()
    createMusic(f.backend, f.ticker).start()
    const before = f.played.length

    f.advance(60)
    const added = f.played.slice(before)
    for (const p of added) {
      expect(p.atSec).toBeGreaterThanOrEqual(160)
    }
    expect(added.length).toBeLessThan(notesForBar(0).length * 4)
  })

  it('끄면 예약된 것까지 끊는다', () => {
    const f = fakes()
    const music = createMusic(f.backend, f.ticker)
    music.start()
    music.stop()

    expect(f.running).toBe(false)
    expect(f.stopAllCount).toBe(1)
    expect(music.playing).toBe(false)
  })

  it('두 번 시작해도 한 번만 돈다', () => {
    // 두 겹으로 돌면 같은 음이 두 번 겹쳐 소리가 두 배로 커진다.
    const f = fakes()
    const music = createMusic(f.backend, f.ticker)
    music.start()
    const after = f.played.length
    music.start()

    expect(f.played.length).toBe(after)
    expect(music.playing).toBe(true)
  })

  it('오디오를 못 열면 조용히 아무 일도 안 한다', () => {
    const music = createMusic(null)
    expect(() => {
      music.start()
      music.stop()
    }).not.toThrow()
    expect(music.playing).toBe(false)
  })
})
