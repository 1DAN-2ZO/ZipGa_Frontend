import { createRng } from '../prng';

/**
 * 카드 뒤집기 — 순수 로직.
 *
 * 이 파일은 react-native / react-native-svg 를 import 하지 않는다.
 * 공정성 검증을 UI 없이 빠르게 돌리기 위해서다.
 */

/** 한 판의 짝 수. */
export const PAIRS = 6;

/** 격자 배치. COLS * ROWS === PAIRS * 2 여야 한다. */
export const COLS = 3;
export const ROWS = 4;
export const CARD_COUNT = PAIRS * 2;

/** 카드 아트 세트 개수. cardArt.tsx 의 SETS.length 와 같아야 한다. */
export const SET_COUNT = 3;

/**
 * 미리 만들어두는 판 수.
 *
 * 이 게임은 한 판을 다 맞추면 새 판이 이어지므로 몇 판까지 갈지 미리 알 수 없다.
 * 제한시간 안에 8판을 넘길 수는 없으므로 넉넉히 8판을 시드에서 한 번에 뽑아둔다.
 * (판마다 즉석에서 뽑으면 판 진행 속도에 따라 난수 소비가 달라져 결정성이 깨진다)
 */
export const MAX_BOARDS = 8;

/**
 * normalizedScore 100점에 해당하는 짝 수.
 *
 * 20초 기준: 한 판(6짝)을 깨고 다음 판에서 몇 개 더 맞히면 잘한 편.
 * ★ 실측 후 반드시 보정할 것 — 이 값 하나가 이 게임의 난이도 전부다.
 */
export const TARGET_PAIRS = 10;

/** 판 시작 시 카드를 전부 보여주는 시간. 이 동안 제한시간은 멈춘다. */
export const PREVIEW_MS = 2000;

/** 짝이 아닐 때 다시 덮이기까지의 시간. */
export const FLIPBACK_MS = 700;

export interface Board {
  /** 이 판에 쓸 카드 아트 세트 인덱스 */
  setIndex: number;
  /** 카드 12장의 값. 각 값(0..PAIRS-1)이 정확히 두 번씩 들어간다. */
  values: number[];
}

/**
 * 시드에서 판 전체를 만든다.
 *
 * 같은 시드를 받은 모든 폰이 같은 배치를 같은 순서로 받는다.
 * 3번째 판까지 간 사람끼리도 3번째 판이 서로 같다.
 */
export function makeBoards(seed: number, setCount: number = SET_COUNT): Board[] {
  const rng = createRng(seed);
  const boards: Board[] = [];
  let prevSet = -1;

  for (let b = 0; b < MAX_BOARDS; b++) {
    let setIndex = rng.int(0, setCount - 1);
    // 직전 판과 같은 세트가 연달아 나오면 "새 판"인 걸 못 알아챈다.
    if (setCount > 1 && setIndex === prevSet) {
      setIndex = (setIndex + 1) % setCount;
    }
    prevSet = setIndex;

    const values: number[] = [];
    for (let v = 0; v < PAIRS; v++) values.push(v, v);

    boards.push({ setIndex, values: rng.shuffle(values) });
  }

  return boards;
}

/**
 * 맞힌 짝 수를 0~100으로 정규화한다.
 *
 * 개수형 매핑: 맞힌 짝 / TARGET_PAIRS × 100, 100에서 자른다.
 */
export function normalize(pairs: number): number {
  return Math.min(100, Math.max(0, (pairs / TARGET_PAIRS) * 100));
}
