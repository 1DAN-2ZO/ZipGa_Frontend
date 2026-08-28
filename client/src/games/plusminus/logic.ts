import { createRng } from '../prng';

/**
 * 더하기 빼기 — 순수 로직.
 *
 * 제한시간 동안 덧셈·뺄셈 문제를 최대한 많이 푼다.
 * 확인 버튼이 없다 — 정답을 다 치는 순간 자동으로 다음 문제로 넘어간다.
 *
 * 구구단과 조작이 같은 이유: 술자리에서 설명 없이 바로 할 수 있어야 한다.
 * 다른 점은 문제가 뒤로 갈수록 커진다는 것이다.
 *
 * 오답에 감점이 없는 이유: 정답을 칠 때까지 넘어가지 않으므로 **시간이 곧 페널티**다.
 * 취해서 헤매면 푼 문제 수가 줄고, 그게 그대로 점수에 반영된다.
 *
 * 답이 음수가 되는 문제는 만들지 않는다. 마이너스를 입력하는 동작이 번거롭고,
 * 취한 사람이 헷갈리는 지점이 "계산"이 아니라 "입력"으로 옮겨가기 때문이다.
 */

/** 미리 만들어두는 문제 수. 제한시간 안에 다 쓸 수 없을 만큼 넉넉하다. */
export const QUESTION_COUNT = 40;

/**
 * 이만큼 맞히면 100점.
 * ★ 실측 후 보정 대상 — 이 값 하나가 이 게임의 난이도 전부다.
 * (구구단 기준값 12보다 낮게 잡은 이유: 처음부터 두 자리라 한 문제에 더 오래 걸린다)
 */
export const TARGET_CORRECT = 8;

/**
 * 정답으로 이어질 수 없는 입력을 지우기까지의 시간(ms).
 *
 * 틀린 숫자를 그대로 두면 입력칸이 꽉 차서 그 문제를 영영 못 푼다.
 * 오타 한 번에 한 문제를 통째로 날리는 셈이라, 잠깐 빨갛게 보여준 뒤 스스로 비운다.
 * 바로 지우면 무엇을 잘못 쳤는지 못 보고, 너무 늦게 지우면 그동안 막혀 있다.
 */
export const WRONG_CLEAR_MS = 400;

/** 답이 가장 클 때가 99+99=198 이므로 입력창은 세 자리까지 받는다. */
export const MAX_ANSWER_DIGITS = 3;

export type Op = '+' | '-';

export interface Question {
  a: number;
  b: number;
  op: Op;
  answer: number;
}

/** 문제 번호 구간마다 쓰는 숫자 범위. */
export interface Tier {
  /** 이 번호 **미만**까지 이 단계를 쓴다 */
  before: number;
  /** 첫 번째 수의 범위 [최소, 최대] */
  a: readonly [number, number];
  /** 두 번째 수의 범위 [최소, 최대] */
  b: readonly [number, number];
  /** 사람이 읽는 이름 (검사·설명용) */
  label: string;
}

/**
 * 난이도 단계.
 *
 * 처음부터 두 자리로 시작하고, 8번째 문제부터 숫자가 더 커진다.
 * (한 자리로 시작해 봤더니 너무 쉬웠다)
 *
 * 시간이 아니라 **문제 번호**로 올린다.
 * 시간으로 올리면 빨리 푸는 사람과 느린 사람이 서로 다른 난이도를 만나 결정성이 깨진다.
 * 번호로 올리면 몇 번째 문제인지가 같은 이상 모두 같은 문제를 본다.
 */
export const TIERS: readonly Tier[] = [
  { before: 8, a: [11, 59], b: [11, 59], label: '두 자리' },
  { before: QUESTION_COUNT, a: [11, 99], b: [11, 99], label: '큰 두 자리' },
];

/** 이 번호의 문제가 어느 단계인지 알려준다. */
export function tierFor(index: number): Tier {
  return TIERS.find((t) => index < t.before) ?? TIERS[TIERS.length - 1];
}

/**
 * 시드에서 문제를 만든다.
 *
 * 같은 시드를 받은 모든 폰이 같은 문제를 같은 순서로 받는다.
 * 이 결정성이 깨지면 "쟤는 쉬운 거 나왔다"는 분쟁이 생긴다.
 *
 * 문제 하나마다 난수를 정확히 세 번(부호·첫 수·둘째 수) 쓴다.
 * 빼기에서 두 수를 맞바꾸는 것은 난수를 더 쓰지 않으므로 순서가 어긋나지 않는다.
 */
export function makeQuestions(seed: number): Question[] {
  const rng = createRng(seed);
  const out: Question[] = [];

  for (let i = 0; i < QUESTION_COUNT; i++) {
    const tier = tierFor(i);
    const op: Op = rng.int(0, 1) === 0 ? '+' : '-';
    let a = rng.int(tier.a[0], tier.a[1]);
    let b = rng.int(tier.b[0], tier.b[1]);

    // 답이 음수가 되지 않게 큰 수를 앞에 둔다
    if (op === '-' && a < b) {
      const t = a;
      a = b;
      b = t;
    }

    out.push({ a, b, op, answer: op === '+' ? a + b : a - b });
  }

  return out;
}

/** 화면에 보여줄 문제 문구. 빼기 기호는 보기 좋은 −(U+2212)를 쓴다. */
export function questionText(q: Question): string {
  return `${q.a} ${q.op === '+' ? '+' : '−'} ${q.b}`;
}

/**
 * 0~100 정규화. 개수형이므로 그대로 비율을 쓴다.
 *
 * 맞힌 문제 / TARGET_CORRECT × 100
 *
 * - 8문제 → 100점
 * - 6문제 → 75점
 * - 3문제 → 38점 (벌칙 기준선 40 미달)
 * - 0문제 → 0점
 */
export function normalize(correct: number): number {
  return Math.min(100, Math.max(0, (correct / TARGET_CORRECT) * 100));
}

/**
 * 지금 입력한 숫자가 정답으로 가는 도중인지 판단한다.
 *
 * 118이 정답일 때 "11"은 아직 치는 중이고 "13"은 이미 틀렸다.
 * 화면 색으로 알려주기 위한 것이고 채점에는 쓰이지 않는다.
 */
export function typingState(input: string, answer: number): 'empty' | 'correct' | 'typing' | 'wrong' {
  if (!input) return 'empty';
  if (Number.parseInt(input, 10) === answer) return 'correct';
  return String(answer).indexOf(input) === 0 ? 'typing' : 'wrong';
}
