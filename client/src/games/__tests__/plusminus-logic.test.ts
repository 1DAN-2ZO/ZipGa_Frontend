import {
  MAX_ANSWER_DIGITS,
  QUESTION_COUNT,
  TARGET_CORRECT,
  TIERS,
  makeQuestions,
  normalize,
  questionText,
  tierFor,
  typingState,
} from '../plusminus/logic';

const SEEDS = [1, 42, 777, 4242, 31337];

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

  it('모든 문제의 답이 실제 계산과 일치한다', () => {
    for (const seed of SEEDS) {
      makeQuestions(seed).forEach((q) => {
        expect(q.answer).toBe(q.op === '+' ? q.a + q.b : q.a - q.b);
      });
    }
  });

  it('답이 음수가 되는 문제를 만들지 않는다', () => {
    for (const seed of SEEDS) {
      makeQuestions(seed).forEach((q) => {
        expect(q.answer).toBeGreaterThanOrEqual(0);
      });
    }
  });

  it('덧셈과 뺄셈이 둘 다 나온다', () => {
    const ops = new Set(makeQuestions(4242).map((q) => q.op));
    expect(ops.has('+')).toBe(true);
    expect(ops.has('-')).toBe(true);
  });

  it('모든 수가 그 번호의 난이도 범위 안에 있다', () => {
    for (const seed of SEEDS) {
      makeQuestions(seed).forEach((q, i) => {
        const t = tierFor(i);
        // 뺄셈은 큰 수를 앞에 두느라 두 수가 맞바뀔 수 있으므로 둘을 합쳐서 본다
        const lo = Math.min(t.a[0], t.b[0]);
        const hi = Math.max(t.a[1], t.b[1]);
        for (const n of [q.a, q.b]) {
          expect(n).toBeGreaterThanOrEqual(lo);
          expect(n).toBeLessThanOrEqual(hi);
        }
      });
    }
  });

  it('답이 입력창 자릿수를 넘지 않는다', () => {
    const max = 10 ** MAX_ANSWER_DIGITS - 1;
    for (const seed of SEEDS) {
      makeQuestions(seed).forEach((q) => {
        expect(q.answer).toBeLessThanOrEqual(max);
      });
    }
  });

  it('모든 수가 두 자리다 (한 자리 문제가 섞이지 않는다)', () => {
    for (const seed of SEEDS) {
      makeQuestions(seed).forEach((q) => {
        expect(q.a).toBeGreaterThanOrEqual(10);
        expect(q.b).toBeGreaterThanOrEqual(10);
      });
    }
  });

  it('뒤로 갈수록 문제가 어려워진다 (앞 8문제 평균 < 뒤 10문제 평균)', () => {
    for (const seed of SEEDS) {
      const qs = makeQuestions(seed);
      const mean = (arr: typeof qs) => arr.reduce((s, q) => s + q.a + q.b, 0) / arr.length;
      expect(mean(qs.slice(0, 8))).toBeLessThan(mean(qs.slice(-10)));
    }
  });
});

describe('tierFor', () => {
  it('첫 문제부터 두 자리 단계다', () => {
    expect(tierFor(0)).toBe(TIERS[0]);
    expect(TIERS[0].a[0]).toBeGreaterThanOrEqual(10);
    expect(TIERS[0].b[0]).toBeGreaterThanOrEqual(10);
  });

  it('마지막 문제는 마지막 단계다', () => {
    expect(tierFor(QUESTION_COUNT - 1)).toBe(TIERS[TIERS.length - 1]);
  });

  it('범위를 넘는 번호가 들어와도 마지막 단계로 버틴다', () => {
    expect(tierFor(QUESTION_COUNT * 10)).toBe(TIERS[TIERS.length - 1]);
  });

  it('단계 경계가 겹치거나 비지 않는다', () => {
    for (let i = 0; i < QUESTION_COUNT; i++) {
      expect(TIERS).toContain(tierFor(i));
    }
  });
});

describe('questionText', () => {
  it('덧셈과 뺄셈 기호를 알맞게 보여준다', () => {
    expect(questionText({ a: 23, b: 41, op: '+', answer: 64 })).toBe('23 + 41');
    expect(questionText({ a: 52, b: 17, op: '-', answer: 35 })).toBe('52 − 17');
  });
});

describe('normalize', () => {
  it('목표 개수를 맞히면 100점이다', () => {
    expect(normalize(TARGET_CORRECT)).toBe(100);
  });

  it('한 문제도 못 맞히면 0점이다', () => {
    expect(normalize(0)).toBe(0);
  });

  it('목표를 넘겨도 100을 넘지 않는다', () => {
    expect(normalize(TARGET_CORRECT * 3)).toBe(100);
  });

  it('맞힐수록 점수가 오른다', () => {
    for (let i = 1; i <= TARGET_CORRECT; i++) {
      expect(normalize(i)).toBeGreaterThan(normalize(i - 1));
    }
  });

  it('계약 범위(0~100)를 벗어나지 않는다', () => {
    for (const n of [-5, 0, 3, TARGET_CORRECT, 999]) {
      expect(normalize(n)).toBeGreaterThanOrEqual(0);
      expect(normalize(n)).toBeLessThanOrEqual(100);
    }
  });
});

describe('typingState', () => {
  it('아무것도 안 쳤으면 비어 있음이다', () => {
    expect(typingState('', 64)).toBe('empty');
  });

  it('정답을 다 치면 맞음이다', () => {
    expect(typingState('64', 64)).toBe('correct');
  });

  it('정답으로 가는 도중이면 치는 중이다', () => {
    expect(typingState('1', 118)).toBe('typing');
    expect(typingState('11', 118)).toBe('typing');
  });

  it('정답으로 이어질 수 없으면 틀림이다', () => {
    expect(typingState('9', 118)).toBe('wrong');
    expect(typingState('13', 118)).toBe('wrong');
  });
});
