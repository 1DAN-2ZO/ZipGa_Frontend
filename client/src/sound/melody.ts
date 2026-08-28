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

/**
 * 음색.
 *
 * lead는 앞에서 튀는 소리, pad는 뒤에 깔리는 소리다. 같은 파형으로 내면
 * 바탕음이 아르페지오와 뭉쳐 한 덩어리로 들린다.
 */
export type Timbre = 'lead' | 'pad'

export interface MusicNote {
  /** 마디 시작으로부터 몇 박 뒤인가. 스윙 때문에 0.6 같은 값이 나온다. */
  atBeat: number
  freq: number
  durationMs: number
  volume: number
  timbre: Timbre
}

/** MIDI 번호를 주파수(Hz)로. 69 = A4 = 440Hz. */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

/**
 * 화음 진행 (C - A - D - G).
 *
 * 전부 장조다. 처음엔 Am으로 시작하는 진행을 썼는데, 뒤에서 장조로 풀리더라도
 * 첫 마디가 단조면 전체가 그 색으로 물들어 처량하게 들렸다. 그 다음 C-F-C-G는
 * 밝긴 한데 제자리만 오가서 동요처럼 밋밋했다.
 *
 * 이건 래그타임이 쓰는 진행이다. A는 D로, D는 G로, G는 C로 — 각 마디가 다음
 * 마디를 끌어당겨서 가만히 있지 못하고 계속 굴러간다. 조 밖의 음(C#, F#)이
 * 섞이지만 모든 소리를 그 화음 안에서만 뽑으므로 어긋나지 않고, 그 덕에
 * 들뜬 느낌이 난다.
 *
 * 폰 스피커는 300Hz 아래를 거의 못 낸다. 여기 쓰는 음은 294~1047Hz다.
 */
interface Chord {
  /** 바탕음이 짚는 음. 옆 마디와 달라야 화음이 바뀐 게 들린다. */
  root: number
  /** 아르페지오가 훑는 네 음 — 근음·3도·5도·한 옥타브 위 근음. */
  voicing: readonly number[]
}

const CHORDS: readonly Chord[] = [
  { root: 72, voicing: [72, 76, 79, 84] }, // C : C5 E5  G5 C6
  { root: 69, voicing: [69, 73, 76, 81] }, // A : A4 C#5 E5 A5
  { root: 62, voicing: [62, 66, 69, 74] }, // D : D4 F#4 A4 D5
  { root: 67, voicing: [67, 71, 74, 79] }, // G : G4 B4  D5 G5
]

/**
 * 8분음표마다 화음의 몇 번째 음을 짚을지. null은 쉼표다.
 *
 * 낮은 음과 한 옥타브 위를 번갈아 짚는다. 공이 튀는 모양 그대로다 — 곧게
 * 오르내리기만 하면 굴러갈 뿐 튀지 않는다. 마지막 한 칸을 비워 숨을 준다.
 * 쉼표가 없으면 음이 빽빽해서 리듬이 아니라 소음으로 들린다.
 */
const PATTERN: readonly (number | null)[] = [0, 3, 1, 3, 2, 3, 1, null]

/**
 * 8분음표마다의 세기.
 *
 * 첫 박과 셋째 박을 세게 해 마디 안에 맥이 생긴다. 밋밋하면 빠르기만 하고
 * 신나지는 않는다.
 */
const STEP_VOLUME: readonly number[] = [0.1, 0.05, 0.085, 0.045, 0.09, 0.05, 0.08, 0]

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
 * 스윙. 뒤 8분음표를 얼마나 늦출지(박 단위).
 *
 * 0.5면 정확히 반박이라 기계적으로 또박또박 간다. 조금 뒤로 미루면 앞이
 * 길고 뒤가 짧아져 "쿵-작 쿵-작"으로 튄다. 이게 통통거림의 대부분이다.
 */
const SWING = 0.6

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
    timbre: 'pad',
  }

  const drive: MusicNote[] = []
  PATTERN.forEach((step, i) => {
    if (step === null) return
    // 짝수 칸은 박에 딱 맞고, 홀수 칸은 SWING만큼 뒤로 밀린다.
    const atBeat = Math.floor(i / SUBDIVISION) + (i % SUBDIVISION === 0 ? 0 : SWING)
    drive.push({
      atBeat,
      freq: midiToFreq(chord.voicing[step]),
      durationMs: stepMs * STACCATO,
      volume: STEP_VOLUME[i],
      timbre: 'lead',
    })
  })

  return [pad, ...drive]
}
