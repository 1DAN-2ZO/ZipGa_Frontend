import { buildSequence, hasTenseConsonant } from '../sentenceCopy/logic'
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

/**
 * 된소리(ㄲ ㄸ ㅃ ㅆ ㅉ) 위주로 뽑는다.
 *
 * 자판에서 shift 를 눌러야 나오는 글자라 손이 한 박자 늦고, 취하면 그 박자가
 * 통째로 무너진다. 문장이 너무 쉬우면 게임이 성립하지 않는다.
 */
describe('된소리', () => {
  it('된소리를 초성에서 찾아낸다', () => {
    for (const text of ['깜빡했어', '뚜껑', '빨대', '쌈장', '짬뽕']) {
      expect(hasTenseConsonant(text)).toBe(true)
    }
  })

  it('받침에 있는 된소리도 찾아낸다', () => {
    // 볶(ㄲ 받침) · 있(ㅆ 받침) — 초성만 보면 놓친다.
    expect(hasTenseConsonant('볶음')).toBe(true)
    expect(hasTenseConsonant('있다')).toBe(true)
  })

  it('된소리가 없으면 없다고 한다', () => {
    for (const text of ['나도 몰라', '집에 가자', '물 좀 마셔']) {
      expect(hasTenseConsonant(text)).toBe(false)
    }
  })

  it('한글이 아닌 글자에 걸려 넘어지지 않는다', () => {
    expect(hasTenseConsonant('abc 123 ?!')).toBe(false)
    expect(hasTenseConsonant('')).toBe(false)
  })

  it('풀의 절반 이상이 된소리 문장이다', () => {
    const tense = SENTENCES.filter(hasTenseConsonant).length
    expect(tense / SENTENCES.length).toBeGreaterThan(0.5)
  })

  it('한 판에서 쓰는 앞부분은 전부 된소리 문장이다', () => {
    // 20초에 열 개를 넘기기는 어렵다. 앞쪽만 채워도 사실상 매 판 된소리다.
    for (const seed of [1, 7, 4242, 20260827]) {
      for (const sentence of buildSequence(seed, SENTENCES).slice(0, 12)) {
        expect(hasTenseConsonant(sentence)).toBe(true)
      }
    }
  })

  it('된소리가 아닌 문장도 버리지 않는다', () => {
    // 풀이 마르면 게임이 끊긴다. 뒤쪽에 그대로 남아 있어야 한다.
    const ordered = buildSequence(4242, SENTENCES)
    expect(ordered).toHaveLength(SENTENCES.length)
    expect([...ordered].sort()).toEqual([...SENTENCES].sort())
  })
})
