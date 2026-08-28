/**
 * 배경음의 가락 — 래그타임.
 *
 * 음원 파일 없이 코드로 만든다(효과음과 같은 이유 — synth.ts). 긴 곡에는
 * 불리한 방식이라 곡을 쓰려 들지 않고, 네 마디짜리 화음 진행을 끝없이 도는
 * 반주로 잡았다.
 *
 * 래그타임인 이유는 이 앱이 술자리 게임이기 때문이다. 왼손이 또박또박
 * 쿵-짝을 짚는 동안 오른손이 그 사이를 비집고 들어가는 구조라, 급한데
 * 무겁지 않다.
 *
 * 이 파일은 "무엇을 언제 낼지"만 정한다. 실제 재생과 예약은 music.ts가 맡는다.
 */

/**
 * 분당 박자.
 *
 * 래그타임 원곡들이 대개 이 언저리다. 더 올리면 왼손의 쿵-짝이 뭉개져
 * 빠르기만 하고 흥이 안 난다.
 */
export const BPM = 150

/** 한 박의 길이(ms) */
export const BEAT_MS = 60_000 / BPM

/** 마디당 박자 수 */
export const BEATS_PER_BAR = 4

/** 한 마디의 길이(ms) */
export const BAR_MS = BEAT_MS * BEATS_PER_BAR

/** 화음 진행의 길이(마디). 이만큼 돌고 처음으로 돌아간다. */
export const PROGRESSION_BARS = 4

/**
 * 소리의 역할.
 *
 * 피아노 한 대지만 왼손·오른손이 하는 일이 달라서, 음역과 길이와 세기를
 * 따로 준다. 음색을 고르는 데도 쓴다(musicBackend.ts).
 */
export type Voice =
  /** 왼손 1·3박 — "쿵" */
  | 'bass'
  /** 왼손 2·4박 — "짝" */
  | 'chord'
  /** 오른손 당김음 */
  | 'melody'

export interface MusicNote {
  /** 마디 시작으로부터 몇 박 뒤인가. 당김음이라 0.75 같은 값이 나온다. */
  atBeat: number
  freq: number
  durationMs: number
  volume: number
  voice: Voice
}

/** MIDI 번호를 주파수(Hz)로. 69 = A4 = 440Hz. */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

interface Chord {
  /** 왼손이 1박에 짚는 음 */
  bass: number
  /** 왼손이 3박에 짚는 음. 보통 5도로 올라가 다음 마디를 준비한다. */
  bassAlt: number
  /** 왼손이 2·4박에 던지는 화음 */
  stab: readonly number[]
  /** 오른손이 훑는 네 음 — 근음·3도·5도·한 옥타브 위 근음 */
  voicing: readonly number[]
}

/**
 * 화음 진행 (C - A - D - G).
 *
 * 래그타임이 쓰는 진행이다. A는 D를, D는 G를, G는 C를 끌어당겨서 가만히
 * 있지 못하고 계속 굴러간다. 전부 장조라 처량한 구석이 없다 — 조 밖의
 * 음(C#, F#)이 섞이지만 모든 소리를 그 화음 안에서만 뽑으므로 어긋나지
 * 않고, 오히려 그 덕에 들뜬 느낌이 난다.
 *
 * 왼손을 진짜 피아노처럼 낮게 두면 폰 스피커에서 안 들린다 — 300Hz 아래는
 * 거의 못 낸다. 통째로 올려 베이스를 196Hz 위에 뒀다. 그래서 원곡보다
 * 가볍고 장난감 피아노에 가깝지만, 안 들리는 것보다 낫다.
 */
const CHORDS: readonly Chord[] = [
  // C
  { bass: 60, bassAlt: 55, stab: [67, 72, 76], voicing: [72, 76, 79, 84] },
  // A
  { bass: 57, bassAlt: 64, stab: [69, 73, 76], voicing: [69, 73, 76, 81] },
  // D
  { bass: 62, bassAlt: 57, stab: [66, 69, 74], voicing: [62, 66, 69, 74] },
  // G
  { bass: 55, bassAlt: 62, stab: [67, 71, 74], voicing: [67, 71, 74, 79] },
]

/**
 * 오른손이 음을 짚는 자리(박).
 *
 * 래그타임의 정체는 이 어긋남이다. 16분음표를 3-3-2로 묶어서, 왼손이
 * 1·2·3·4를 또박또박 짚는 동안 오른손은 0.75·1.5·2.75·3.5처럼 박 사이로
 * 비껴 들어간다. 이 어긋남이 없으면 아무리 빨라도 그냥 행진곡이다.
 */
const MELODY_BEATS: readonly number[] = [0, 0.75, 1.5, 2, 2.75, 3.5]

/** 오른손이 그 자리에서 짚는 음(voicing의 몇 번째). 올라갔다 내려오는 활 모양. */
const MELODY_STEPS: readonly number[] = [0, 2, 3, 2, 1, 2]

/** 오른손 세기. 첫 음과 당겨 들어가는 음을 세게 해서 어긋남이 들린다. */
const MELODY_VOLUME: readonly number[] = [0.075, 0.06, 0.055, 0.07, 0.06, 0.05]

/** 왼손 "쿵" 세기 */
const BASS_VOLUME = 0.075
/** 왼손 "짝" 세기. 화음이라 세 음이 겹치므로 하나하나는 작게 잡는다. */
const STAB_VOLUME = 0.032

/**
 * 이 마디에서 낼 음들.
 *
 * barIndex는 곡 시작부터의 마디 번호다. 진행 길이로 나눈 나머지가 화음을
 * 정하므로 몇 번째 마디든 계산이 되고, 재생 중간에 들어와도 자리가 맞는다.
 */
export function notesForBar(barIndex: number): MusicNote[] {
  const chord = CHORDS[((barIndex % PROGRESSION_BARS) + PROGRESSION_BARS) % PROGRESSION_BARS]
  const notes: MusicNote[] = []

  // 왼손 — 쿵(1박) 짝(2박) 쿵(3박) 짝(4박)
  for (const [beat, midi] of [
    [0, chord.bass],
    [2, chord.bassAlt],
  ] as const) {
    notes.push({
      atBeat: beat,
      freq: midiToFreq(midi),
      // 다음 "짝"까지 울린다. 왼손이 끊기면 바닥이 사라져 붕 뜬다.
      durationMs: BEAT_MS * 0.85,
      volume: BASS_VOLUME,
      voice: 'bass',
    })
  }

  for (const beat of [1, 3]) {
    for (const midi of chord.stab) {
      notes.push({
        atBeat: beat,
        freq: midiToFreq(midi),
        // 짧게 던진다. 길면 "짝"이 아니라 깔리는 소리가 된다.
        durationMs: BEAT_MS * 0.32,
        volume: STAB_VOLUME,
        voice: 'chord',
      })
    }
  }

  // 오른손 — 박 사이로 비껴 들어간다
  MELODY_BEATS.forEach((beat, i) => {
    notes.push({
      atBeat: beat,
      freq: midiToFreq(chord.voicing[MELODY_STEPS[i]]),
      durationMs: BEAT_MS * 0.42,
      volume: MELODY_VOLUME[i],
      voice: 'melody',
    })
  })

  return notes
}
