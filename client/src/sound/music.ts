import { BAR_MS, BEAT_MS, notesForBar, type MusicNote } from './melody'

/**
 * 배경음 재생.
 *
 * 끝이 없는 소리라 효과음처럼 "한 번 내고 끝"으로는 못 만든다. 그렇다고 전부
 * 미리 예약할 수도 없어서, 주기적으로 깨어나 조금 앞까지만 예약하는 방식을 쓴다.
 * 오디오 시계로 예약하므로 이 깨어나는 주기가 흔들려도 박자는 안 흔들린다.
 */

/** 얼마나 자주 깨어나 예약할지(ms) */
export const LOOKAHEAD_MS = 250

/**
 * 얼마나 앞까지 예약할지(초).
 *
 * 깨어나는 주기보다 넉넉해야 한 번 늦어도 소리가 안 끊긴다. 대신 이만큼은
 * 이미 예약돼 있으므로 끄는 순간 바로 조용해지지 않는다 — 그래서 stop()이
 * 예약된 것까지 직접 끊는다.
 */
export const SCHEDULE_AHEAD_SEC = 0.7

/** 실제로 소리를 내는 쪽. 테스트에서 갈아끼운다. */
export interface MusicBackend {
  /** 오디오 시계의 현재 시각(초) */
  nowSec: () => number
  /** delaySec 뒤에 음 하나를 낸다 */
  play: (note: MusicNote, delaySec: number) => void
  /** 예약된 것까지 전부 끊는다 */
  stopAll: () => void
}

/** 주기 실행. 테스트에서 갈아끼운다. */
export interface Ticker {
  every: (ms: number, fn: () => void) => unknown
  cancel: (handle: unknown) => void
}

const realTicker: Ticker = {
  every: (ms, fn) => setInterval(fn, ms),
  cancel: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
}

export interface Music {
  start: () => void
  stop: () => void
  readonly playing: boolean
}

export function createMusic(backend: MusicBackend | null, ticker: Ticker = realTicker): Music {
  let handle: unknown = null
  let nextBar = 0
  let nextBarAtSec = 0

  /** 지금부터 SCHEDULE_AHEAD_SEC 앞까지의 마디를 예약한다. */
  const pump = () => {
    if (!backend) return
    const now = backend.nowSec()
    while (nextBarAtSec < now + SCHEDULE_AHEAD_SEC) {
      for (const note of notesForBar(nextBar)) {
        const atSec = nextBarAtSec + (note.atBeat * BEAT_MS) / 1000
        // 이미 지난 음은 건너뛴다. 탭 전환 등으로 타이머가 오래 멈췄다 깨면
        // 밀린 마디가 한꺼번에 쏟아져 화음이 뭉개진다.
        if (atSec >= now) backend.play(note, atSec - now)
      }
      nextBar += 1
      nextBarAtSec += BAR_MS / 1000
    }
  }

  return {
    get playing() {
      return handle !== null
    },

    start() {
      if (handle !== null || !backend) return
      nextBar = 0
      // 첫 마디를 아주 살짝 뒤로 미룬다. 지금 시각에 딱 맞추면 예약이 늦어
      // 첫 음이 잘린다.
      nextBarAtSec = backend.nowSec() + 0.06
      pump()
      handle = ticker.every(LOOKAHEAD_MS, pump)
    },

    stop() {
      if (handle !== null) {
        ticker.cancel(handle)
        handle = null
      }
      backend?.stopAll()
    },
  }
}
