/**
 * 배경음의 가락.
 *
 * 음원 파일 없이 코드로 만든다(효과음과 같은 이유 — synth.ts). 긴 곡에는
 * 불리한 방식이라 곡을 쓰려 들지 않고, 네 마디짜리 화음 진행을 끝없이 도는
 * 반주로 잡았다.
 *
 * 이 파일은 "무엇을 언제 낼지"만 정한다. 실제 재생과 예약은 music.ts가 맡는다.
 */

/**
 * 분당 박자.
 *
 * 처음엔 96으로 잡았는데 술자리 배경으로는 처졌다. 이 앱은 20초 안에 뭔가를
 * 해내야 하는 게임이 계속 도는 곳이라 재촉하는 쪽이 맞는다.
 */
export const BPM = 150

/** 한 박의 길이(ms) */
export const BEAT_MS = 60_000 / BPM

/** 마디당 박자 수 */
export const BEATS_PER_BAR = 4

/** 한 마디의 길이(ms) */
export const BAR_MS = BEAT_MS * BEATS_PER_BAR

/** 한 박을 몇 번으로 쪼개 짚는가. 2면 8분음표. */
export const SUBDIVISION = 2

/** 한 마디에 짚는 음의 수 */
export const STEPS_PER_BAR = BEATS_PER_BAR * SUBDIVISION

/** 화음 진행의 길이(마디). 이만큼 돌고 처음으로 돌아간다. */
export const PROGRESSION_BARS = 4

export interface MusicNote {
  /** 마디 시작으로부터 몇 박 뒤인가. 8분음표라 0.5 단위가 나온다. */
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
 * 화음 진행 (Am - F - C - G).
 *
 * 단조로 시작해 장조로 풀리는 진행이라 계속 앞으로 밀린다. 어디서 끊어도
 * 다음 마디로 이어져 끝없이 돌 수 있다.
 *
 * 음을 한 옥타브 올려 잡았다 — 폰 스피커는 300Hz 아래를 거의 못 내서
 * 제대로 된 베이스를 깔아봐야 들리지 않는다. 여기 쓰는 음은 349~659Hz다.
 */
interface Chord {
  /** 바탕음이 짚는 음. 마디마다 달라야 화음이 바뀐 게 들린다. */
  root: number
  /** 8분음표가 오가는 세 음. 앞뒤 마디와 가깝게 눕혀 매끄럽게 잇는다. */
  voicing: readonly number[]
}

const CHORDS: readonly Chord[] = [
  { root: 69, voicing: [69, 72, 76] }, // Am : A4 C5 E5
  { root: 65, voicing: [65, 69, 72] }, // F  : F4 A4 C5
  { root: 72, voicing: [67, 72, 76] }, // C  : G4 C5 E5
  { root: 67, voicing: [67, 71, 74] }, // G  : G4 B4 D5
]

/**
 * 8분음표마다 화음의 몇 번째 음을 짚을지.
 *
 * 근음과 5도를 오가며 3도를 끼운다. 같은 자리를 반복하지 않아야 굴러가는
 * 느낌이 나고, 한 마디 안에서 두 번 같은 모양이 돌아 박자가 또렷해진다.
 */
const PATTERN: readonly number[] = [0, 2, 1, 2, 0, 2, 1, 2]

/**
 * 8분음표마다의 세기.
 *
 * 첫 박과 셋째 박을 세게 해 마디 안에 맥이 생긴다. 밋밋하면 빠르기만 하고
 * 신나지는 않는다.
 */
const STEP_VOLUME: readonly number[] = [0.1, 0.05, 0.07, 0.05, 0.09, 0.05, 0.07, 0.05]

/**
 * 바탕에 깔리는 음의 세기. 이것만 마디 내내 이어진다.
 *
 * 한 옥타브 내려 깔다가 올렸다. 폰 스피커가 못 내는 음역(300Hz 아래)이라
 * 들리지도 않으면서 화음이 바뀌는 것만 흐려졌다. 짚는 음과 같은 옥타브에
 * 두면 스타카토로 끊긴 사이를 메워 준다.
 */
const PAD_VOLUME = 0.04

/**
 * 음 길이를 8분음표의 몇 배로 할지.
 *
 * 1보다 한참 작게 끊는다(스타카토). 이어 붙이면 같은 빠르기여도 늘어져
 * 들리고, 끊으면 몰아친다.
 */
const STACCATO = 0.55

/**
 * 이 마디에서 낼 음들.
 *
 * barIndex는 곡 시작부터의 마디 번호다. 진행 길이로 나눈 나머지가 화음을
 * 정하므로 몇 번째 마디든 계산이 되고, 재생 중간에 들어와도 자리가 맞는다.
 */
export function notesForBar(barIndex: number): MusicNote[] {
  const chord = CHORDS[((barIndex % PROGRESSION_BARS) + PROGRESSION_BARS) % PROGRESSION_BARS]
  const stepMs = BEAT_MS / SUBDIVISION

  // 마디 내내 이어지는 바탕음.
  const pad: MusicNote = {
    atBeat: 0,
    freq: midiToFreq(chord.root),
    durationMs: BAR_MS,
    volume: PAD_VOLUME,
  }

  const drive = PATTERN.map((step, i) => ({
    atBeat: i / SUBDIVISION,
    freq: midiToFreq(chord.voicing[step]),
    durationMs: stepMs * STACCATO,
    volume: STEP_VOLUME[i],
  }))

  return [pad, ...drive]
}
