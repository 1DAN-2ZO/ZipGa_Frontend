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

/**
 * 계란에 금이 하나 더 가는 데 필요한 타수.
 *
 * 목표(150)를 딱 나누어떨어지지 않게 잡았다. 마지막 금이 140에서 나오고
 * 부화까지 10회가 더 남아, "다 깨졌는데 아직 안 나온다"는 구간이 생긴다.
 * 나누어떨어지면 그 마지막 긴장이 없어진다.
 */
export const TAPS_PER_CRACK = 20

/**
 * 부화 전까지 생기는 금의 총 개수.
 *
 * 목표에 닿기 전 마지막 금까지 세므로 -1을 빼고 나눈다.
 * 그림(Egg.tsx)에 이 개수만큼 금이 그려져 있다.
 */
export const CRACK_STAGES = Math.floor((TARGET_TAPS - 1) / TAPS_PER_CRACK)

/** 지금 몇 번째 금까지 가 있는지. 0이면 아직 멀쩡한 계란이다. */
export function crackStage(taps: number): number {
  if (taps <= 0) return 0
  return Math.min(Math.floor(taps / TAPS_PER_CRACK), CRACK_STAGES)
}
