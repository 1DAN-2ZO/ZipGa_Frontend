import {
  MAX_FACTOR,
  MIN_FACTOR,
  QUESTION_COUNT,
  TARGET_CORRECT,
  makeQuestions,
  normalize,
  typingState,
} from '../gugudan/logic';

describe('makeQuestions', () => {
  it('같은 시드는 같은 문제를 같은 순서로 만든다', () => {
    expect(makeQuestions(31337)).toEqual(makeQuestions(31337));
  });

  it('다른 시드는 다른 문제를 만든다', () => {
    expect(makeQuestions(1)).not.toEqual(makeQuestions(2));
  });

  it('제한시간 안에 다 못 쓸 만큼 넉넉하게 만든다', () => {
    expect(makeQuestions(7)).toHaveLength(QUESTION_COUNT);
  });

  it('모든 문제가 2~9단 범위 안에 있고 답이 맞는다', () => {
    for (const seed of [1, 42, 777, 31337]) {
      for (const q of makeQuestions(seed)) {
        expect(q.a).toBeGreaterThanOrEqual(MIN_FACTOR);
        expect(q.a).toBeLessThanOrEqual(MAX_FACTOR);
        expect(q.b).toBeGreaterThanOrEqual(MIN_FACTOR);
        expect(q.b).toBeLessThanOrEqual(MAX_FACTOR);
        expect(q.answer).toBe(q.a * q.b);
      }
    }
  });

  it('답이 모두 두 자리 이하다 (입력창 maxLength=2 전제)', () => {
    for (const q of makeQuestions(99)) {
      expect(q.answer).toBeLessThanOrEqual(99);
    }
  });
});

describe('normalize', () => {
  it('목표 개수를 맞히면 100점이다', () => {
    expect(normalize(TARGET_CORRECT)).toBe(100);
  });

  it('한 문제도 못 맞히면 0점이다', () => {
    expect(normalize(0)).toBe(0);
  });

  it('목표를 넘겨도 100점을 넘지 않는다', () => {
    expect(normalize(TARGET_CORRECT * 3)).toBe(100);
  });

  it('많이 맞힐수록 점수가 높다', () => {
    for (let i = 1; i <= TARGET_CORRECT; i++) {
      expect(normalize(i)).toBeGreaterThan(normalize(i - 1));
    }
  });

  it('0~100 밖으로 나가지 않는다', () => {
    for (let i = 0; i <= 40; i++) {
      expect(normalize(i)).toBeGreaterThanOrEqual(0);
      expect(normalize(i)).toBeLessThanOrEqual(100);
    }
  });
});

describe('typingState', () => {
  it('아무것도 안 쳤으면 empty', () => {
    expect(typingState('', 56)).toBe('empty');
  });

  it('정답을 다 치면 correct', () => {
    expect(typingState('56', 56)).toBe('correct');
  });

  it('정답으로 가는 도중이면 typing', () => {
    expect(typingState('5', 56)).toBe('typing');
  });

  it('첫 자리부터 다르면 wrong', () => {
    expect(typingState('7', 56)).toBe('wrong');
    expect(typingState('54', 56)).toBe('wrong');
  });

  it('한 자리 정답도 판정된다', () => {
    expect(typingState('6', 6)).toBe('correct');
    expect(typingState('9', 6)).toBe('wrong');
  });
});
