import { SENTENCES } from '../sentenceCopy/sentences';

describe('SENTENCES', () => {
  test('한 판에 몇 개만 소비되므로 풀이 넉넉해야 매번 다른 문장이 나온다', () => {
    expect(SENTENCES.length).toBeGreaterThanOrEqual(60);
  });

  test('중복된 문장이 없다', () => {
    expect(new Set(SENTENCES).size).toBe(SENTENCES.length);
  });

  test('빈 문장이 없다', () => {
    expect(SENTENCES.filter((s) => s.trim() === '')).toEqual([]);
  });

  test('앞뒤 공백이 없다 — 있으면 정답 판정이 헷갈린다', () => {
    expect(SENTENCES.filter((s) => s !== s.trim())).toEqual([]);
  });

  test('20초 안에 여러 개를 칠 수 있도록 전부 짧다', () => {
    expect(SENTENCES.filter((s) => s.length > 18)).toEqual([]);
  });
});
