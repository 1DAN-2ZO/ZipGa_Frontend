import {
  FOUL_CM,
  MISS_CM,
  ROUNDS,
  Round,
  TARGET_TOTAL_CM,
  WAIT_MAX_MS,
  WAIT_MIN_MS,
  averageCaughtMs,
  fallDistanceCm,
  makeWaits,
  normalize,
  roundCm,
  totalCm,
} from '../rulercatch/logic';

const caught = (ms: number): Round => ({ kind: 'caught', cm: roundCm('caught', ms), ms });
const foul = (): Round => ({ kind: 'foul', cm: FOUL_CM, ms: null });
const missed = (): Round => ({ kind: 'miss', cm: MISS_CM, ms: null });

describe('makeWaits', () => {
  it('같은 시드는 같은 낙하 타이밍을 만든다', () => {
    expect(makeWaits(31337)).toEqual(makeWaits(31337));
  });

  it('다른 시드는 다른 낙하 타이밍을 만든다', () => {
    expect(makeWaits(1)).not.toEqual(makeWaits(2));
  });

  it('라운드 수만큼 만든다', () => {
    expect(makeWaits(7)).toHaveLength(ROUNDS);
  });

  it('대기 시간이 정해진 범위 안에 있다', () => {
    for (const seed of [1, 42, 777, 31337]) {
      for (const w of makeWaits(seed)) {
        expect(w).toBeGreaterThanOrEqual(WAIT_MIN_MS);
        expect(w).toBeLessThanOrEqual(WAIT_MAX_MS);
        expect(Number.isInteger(w)).toBe(true);
      }
    }
  });
});

describe('fallDistanceCm', () => {
  it('자유낙하 공식과 맞는다', () => {
    expect(fallDistanceCm(200)).toBeCloseTo(19.6, 1);
    expect(fallDistanceCm(300)).toBeCloseTo(44.1, 1);
  });

  it('느릴수록 멀리 떨어진다', () => {
    expect(fallDistanceCm(300)).toBeGreaterThan(fallDistanceCm(200));
  });

  it('0 이하에도 터지지 않는다', () => {
    expect(fallDistanceCm(0)).toBe(0);
    expect(fallDistanceCm(-50)).toBe(0);
  });
});

describe('roundCm', () => {
  it('잡았으면 낙하 길이를 쓴다', () => {
    expect(roundCm('caught', 300)).toBeCloseTo(44.1, 1);
  });

  it('파울과 놓침은 환산값으로 바뀐다', () => {
    expect(roundCm('foul', 0)).toBe(FOUL_CM);
    expect(roundCm('miss', 9999)).toBe(MISS_CM);
  });

  it('0cm 로 기록되지 않는다 — 무한대 점수를 막는다', () => {
    expect(roundCm('caught', 0)).toBeGreaterThan(0);
  });

  it('파울이 잘 잡은 라운드보다 항상 나쁘다', () => {
    expect(roundCm('foul', 0)).toBeGreaterThan(roundCm('caught', 400));
  });
});

describe('totalCm', () => {
  it('세 라운드를 더한다', () => {
    expect(totalCm([caught(300), caught(300), caught(300)])).toBeCloseTo(44.1 * 3, 0);
  });

  it('못 한 라운드는 놓침으로 채운다 — 적게 할수록 유리하면 안 된다', () => {
    const one = totalCm([caught(300)]);
    const three = totalCm([caught(300), caught(300), caught(300)]);
    expect(one).toBeGreaterThan(three);
    expect(one).toBeCloseTo(44.1 + MISS_CM * 2, 0);
  });

  it('한 라운드도 못 하면 전부 놓침으로 친다', () => {
    expect(totalCm([])).toBe(MISS_CM * ROUNDS);
  });
});

describe('normalize', () => {
  it('목표 합계를 채우면 100이다', () => {
    const each = TARGET_TOTAL_CM / ROUNDS;
    const rounds: Round[] = [
      { kind: 'caught', cm: each, ms: 240 },
      { kind: 'caught', cm: each, ms: 240 },
      { kind: 'caught', cm: each, ms: 240 },
    ];
    expect(normalize(rounds)).toBeCloseTo(100, 5);
  });

  it('목표보다 짧아도 100을 넘지 않는다', () => {
    expect(normalize([caught(80), caught(80), caught(80)])).toBe(100);
  });

  it('길수록 점수가 낮다', () => {
    const fast = normalize([caught(260), caught(260), caught(260)]);
    const slow = normalize([caught(460), caught(460), caught(460)]);
    expect(fast).toBeGreaterThan(slow);
  });

  it('파울만 반복하면 벌칙 기준선 아래로 떨어진다', () => {
    expect(normalize([foul(), foul(), foul()])).toBeLessThan(40);
  });

  it('전부 놓쳐도 0점 처리하지 않는다 — 감점일 뿐이다', () => {
    const v = normalize([missed(), missed(), missed()]);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(40);
  });

  it('파울이 섞이면 합계가 나빠진다', () => {
    const clean = [caught(280), caught(300), caught(290)];
    const dirty = [caught(280), foul(), caught(290)];
    expect(normalize(dirty)).toBeLessThan(normalize(clean));
  });

  it('맨정신 수준(300ms)이면 기준선을 넉넉히 넘는다', () => {
    expect(normalize([caught(300), caught(300), caught(300)])).toBeGreaterThan(40);
  });

  it('항상 0~100 안에 있다', () => {
    const cases: Round[][] = [
      [], [caught(1)], [caught(99999)], [foul()], [missed()],
      [caught(200), foul(), missed()],
    ];
    for (const c of cases) {
      const v = normalize(c);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe('averageCaughtMs', () => {
  it('잡은 라운드만 평균낸다', () => {
    expect(averageCaughtMs([caught(200), caught(300), foul()])).toBe(250);
  });

  it('한 번도 못 잡았으면 null 이다', () => {
    expect(averageCaughtMs([foul(), missed()])).toBeNull();
    expect(averageCaughtMs([])).toBeNull();
  });
});
