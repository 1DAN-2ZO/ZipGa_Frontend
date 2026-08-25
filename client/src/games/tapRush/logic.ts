/**
 * 목표 타수. 도달하면 제한시간을 남기고 즉시 끝난다.
 *
 * 이 게임의 유일한 난이도 손잡이다. 20초 기준 초당 7.5회로,
 * 잘하는 사람은 닿고 보통은 못 닿는 선으로 잡았다.
 *
 * 목표를 두는 이유는 두 가지다. 점수에 상한이 없으면 0~100 정규화를
 * 할 수 없고, 모두가 시간을 다 쓰면 tiebreakMs가 전부 같아져 동점을
 * 가릴 수 없다. 먼저 채운 사람이 먼저 끝나야 순위가 갈린다.
 */
export const TARGET_TAPS = 150

/** 타수를 0~100으로 정규화한다. */
export function normalize(taps: number): number {
  const ratio = (taps / TARGET_TAPS) * 100
  return Math.min(100, Math.max(0, ratio))
}

/** 목표를 채웠는가. 채웠으면 시간이 남아도 끝낸다. */
export function isComplete(taps: number): boolean {
  return taps >= TARGET_TAPS
}
