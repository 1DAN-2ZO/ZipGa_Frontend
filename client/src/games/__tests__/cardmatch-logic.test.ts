import {
  CARD_COUNT,
  COLS,
  MAX_BOARDS,
  PAIRS,
  ROWS,
  SET_COUNT,
  TARGET_PAIRS,
  makeBoards,
  normalize,
} from '../cardmatch/logic';

describe('격자 상수', () => {
  it('격자 칸 수와 카드 수가 맞는다', () => {
    expect(COLS * ROWS).toBe(PAIRS * 2);
    expect(CARD_COUNT).toBe(PAIRS * 2);
  });
});

describe('makeBoards', () => {
  it('같은 시드는 완전히 같은 판을 만든다', () => {
    expect(makeBoards(31337)).toEqual(makeBoards(31337));
  });

  it('다른 시드는 다른 판을 만든다', () => {
    expect(makeBoards(1)).not.toEqual(makeBoards(2));
  });

  it('정해진 판 수만큼 미리 만든다', () => {
    expect(makeBoards(7)).toHaveLength(MAX_BOARDS);
  });

  it('한 판은 카드 12장이다', () => {
    for (const b of makeBoards(7)) {
      expect(b.values).toHaveLength(CARD_COUNT);
    }
  });

  it('모든 값이 정확히 두 번씩 들어간다', () => {
    for (const b of makeBoards(99)) {
      const counts = new Map<number, number>();
      for (const v of b.values) counts.set(v, (counts.get(v) ?? 0) + 1);
      expect(counts.size).toBe(PAIRS);
      for (const n of counts.values()) expect(n).toBe(2);
    }
  });

  it('세트 인덱스가 범위 안에 있다', () => {
    for (const b of makeBoards(5)) {
      expect(b.setIndex).toBeGreaterThanOrEqual(0);
      expect(b.setIndex).toBeLessThan(SET_COUNT);
    }
  });

  it('같은 세트가 연달아 나오지 않는다', () => {
    // 판이 바뀐 걸 못 알아채면 방금 외운 배치와 새 배치가 섞여 헷갈린다.
    for (const seed of [1, 2, 3, 42, 999, 31337]) {
      const boards = makeBoards(seed);
      for (let i = 1; i < boards.length; i++) {
        expect(boards[i].setIndex).not.toBe(boards[i - 1].setIndex);
      }
    }
  });

  it('세트가 하나뿐이어도 터지지 않는다', () => {
    const boards = makeBoards(7, 1);
    expect(boards).toHaveLength(MAX_BOARDS);
    for (const b of boards) expect(b.setIndex).toBe(0);
  });
});

describe('normalize', () => {
  it('목표치를 채우면 100이다', () => {
    expect(normalize(TARGET_PAIRS)).toBe(100);
  });

  it('하나도 못 맞히면 0이다', () => {
    expect(normalize(0)).toBe(0);
  });

  it('절반이면 50이다', () => {
    expect(normalize(TARGET_PAIRS / 2)).toBe(50);
  });

  it('음수는 0으로 자른다', () => {
    expect(normalize(-3)).toBe(0);
  });

  it('목표치를 넘어도 100을 넘지 않는다', () => {
    expect(normalize(TARGET_PAIRS + 20)).toBe(100);
  });
});
