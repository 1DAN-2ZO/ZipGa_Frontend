/**
 * 배경음의 가락.
 *
 * 음원 파일 없이 코드로 만든다(효과음과 같은 이유 — synth.ts). 긴 곡에는
 * 불리한 방식이라 곡을 쓰려 들지 않고, 네 마디짜리 화음 진행을 끝없이 도는
 * 얕은 반주로 잡았다. 술자리 배경에 깔리는 소리라 기억에 남을 필요가 없다.
 *
 * 이 파일은 "무엇을 언제 낼지"만 정한다. 실제 재생과 예약은 music.ts가 맡는다.
 */

/** 분당 박자. 느리면 처지고 빠르면 게임 소리와 부딪힌다. */
export const BPM = 96

/** 한 박의 길이(ms) */
export const BEAT_MS = 60_000 / BPM

/** 마디당 박자 수 */
export const BEATS_PER_BAR = 4

/** 한 마디의 길이(ms) */
export const BAR_MS = BEAT_MS * BEATS_PER_BAR

/** 화음 진행의 길이(마디). 이만큼 돌고 처음으로 돌아간다. */
export const PROGRESSION_BARS = 4

export interface MusicNote {
  /** 마디 시작으로부터 몇 박 뒤인가 */
  atBeat: number
  freq: number
  durationMs: number
  volume: number
}

/** MIDI 번호를 주파수(Hz)로. 69 = A4 = 440Hz. */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/**
 * 화음 진행 (C - Am - F - G).
 *
 * 어디서 끊어도 다음 마디로 자연스럽게 이어지는 진행이라 끝없이 돌 수 있다.
 * 음을 한 옥타브 올려 잡았다 — 폰 스피커는 300Hz 아래를 거의 못 내서
 * 제대로 된 베이스를 깔아봐야 들리지 않는다. 여기 쓰는 음은 175~784Hz다.
 */
const CHORDS: readonly (readonly number[])[] = [
  [72, 76, 79], // C  : C5 E5 G5
  [69, 72, 76], // Am : A4 C5 E5
  [65, 69, 72], // F  : F4 A4 C5
  [67, 71, 74], // G  : G4 B4 D5
]

/** 각 박에서 화음의 몇 번째 음을 짚을지. 근음 - 5도 - 3도 - 5도. */
const PATTERN: readonly number[] = [0, 2, 1, 2]

/** 박마다의 세기. 첫 박만 조금 세게 해서 마디 구분이 들린다. */
const BEAT_VOLUME: readonly number[] = [0.09, 0.055, 0.07, 0.05]

/** 바탕에 깔리는 음의 세기. 이것만 마디 내내 이어진다. */
const PAD_VOLUME = 0.045

/**
 * 이 마디에서 낼 음들.
 *
 * barIndex는 곡 시작부터의 마디 번호다. 진행 길이로 나눈 나머지가 화음을
 * 정하므로 몇 번째 마디든 계산이 되고, 재생 중간에 들어와도 자리가 맞는다.
 */
export function notesForBar(barIndex: number): MusicNote[] {
  const chord = CHORDS[((barIndex % PROGRESSION_BARS) + PROGRESSION_BARS) % PROGRESSION_BARS]

  // 마디 내내 이어지는 바탕음. 한 옥타브 아래 근음이다.
  const pad: MusicNote = {
    atBeat: 0,
    freq: midiToFreq(chord[0] - 12),
    durationMs: BAR_MS,
    volume: PAD_VOLUME,
  }

  const arpeggio = PATTERN.map((step, beat) => ({
    atBeat: beat,
    freq: midiToFreq(chord[step]),
    // 다음 박까지 살짝 못 미치게 끊는다. 겹치면 뭉개져서 화음이 흐려진다.
    durationMs: BEAT_MS * 0.9,
    volume: BEAT_VOLUME[beat],
  }))

  return [pad, ...arpeggio]
}
