import { createWebAudioBackend } from './backend'
import { createMusic, type Music } from './music'
import { createMusicBackend } from './musicBackend'
import { createSynth, type Synth } from './synth'

export type { Note, Synth } from './synth'

/**
 * 앱 전체가 공유하는 신디사이저.
 *
 * 소리를 한 곳에서 내는 이유는 두 가지다. 설정의 "효과음 끄기"를 한 번만
 * 강제하면 되고, 게임 10종의 볼륨과 톤이 제각각이 되지 않는다.
 * 게임 담당자는 오디오 코드를 짤 필요가 없다.
 */
export const synth: Synth = createSynth(createWebAudioBackend())

/** 설정 토글이 부른다. 끄면 앱 전체가 조용해진다. */
export function setSoundEnabled(enabled: boolean): void {
  synth.setEnabled(enabled)
}

/**
 * 앱 전체가 공유하는 배경음.
 *
 * 효과음과 따로 두는 이유는 설정에 토글이 둘이기 때문이다 — 배경음만 끄고
 * 게임 소리는 듣고 싶은 경우가 실제로 많다.
 */
export const music: Music = createMusic(createMusicBackend())

export { useBackgroundMusic } from './useBackgroundMusic'
export { useGameSound, type GameSound } from './useGameSound'
export { useAppSound, type AppSound } from './useAppSound'
