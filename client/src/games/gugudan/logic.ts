import { createRng } from '../prng';

/**
 * 구구단 — 순수 로직.
 *
 * 3초 카운트다운 뒤 제한시간 동안 곱셈 문제를 최대한 많이 푼다.
 * 확인 버튼이 없다 — 정답을 다 치는 순간 자동으로 다음 문제로 넘어간다.
 *
 * 오답에 감점이 없는 이유: 정답을 칠 때까지 넘어가지 않으므로 **시간이 곧 페널티**다.
 * 취해서 헤매면 푼 문제 수가 줄고, 그게 그대로 점수에 반영된다.
 */

/** 미리 만들어두는 문제 수. 제한시간 안에 다 쓸 수 없을 만큼 넉넉하다. */
export const QUESTION_COUNT = 40;

/** 곱하는 수의 범위. 1단·10단은 너무 쉬워서 뺐다. */
export const MIN_FACTOR = 2;
export const MAX_FACTOR = 9;

/** 시작 카운트다운(ms). 이 동안 문제가 보이지 않는다. */
export const COUNTDOWN_MS = 3000;

/**
 * 정답으로 이어질 수 없는 입력을 지우기까지의 시간(ms).
 *
 * 틀린 숫자를 그대로 두면 입력칸이 꽉 차서 그 문제를 영영 못 푼다.
 * 오타 한 번에 한 문제를 통째로 날리는 셈이라, 잠깐 빨갛게 보여준 뒤 스스로 비운다.
 * 바로 지우면 무엇을 잘못 쳤는지 못 보고, 너무 늦게 지우면 그동안 막혀 있다.
 */
export const WRONG_CLEAR_MS = 400;

/**
 * 이만큼 맞히면 100점.
 * ★ 실측 후 보정 대상 — 이 값 하나가 이 게임의 난이도 전부다.
 */
export const TARGET_CORRECT = 12;

export interface Question {
  a: number;
  b: number;
  answer: number;
}

/**
 * 시드에서 문제를 만든다.
 *
 * 같은 시드를 받은 모든 폰이 같은 문제를 같은 순서로 받는다.
 * 이 결정성이 깨지면 "쟤는 쉬운 거 나왔다"는 분쟁이 생긴다.
 */
export function makeQuestions(seed: number): Question[] {
  const rng = createRng(seed);
  const out: Question[] = [];
  for (let i = 0; i < QUESTION_COUNT; i++) {
    const a = rng.int(MIN_FACTOR, MAX_FACTOR);
    const b = rng.int(MIN_FACTOR, MAX_FACTOR);
    out.push({ a, b, answer: a * b });
  }
  return out;
}

/**
 * 0~100 정규화. 개수형이므로 그대로 비율을 쓴다.
 *
 * 맞힌 문제 / TARGET_CORRECT × 100
 *
 * - 12문제 → 100점
 * - 9문제  → 75점
 * - 5문제  → 42점 (벌칙 기준선 40 턱걸이)
 * - 0문제  → 0점
 */
export function normalize(correct: number): number {
  return Math.min(100, Math.max(0, (correct / TARGET_CORRECT) * 100));
}

/**
 * 지금 입력한 숫자가 정답으로 가는 도중인지 판단한다.
 *
 * 56이 정답일 때 "5"는 아직 치는 중이고 "7"은 이미 틀렸다.
 * 화면 색으로 알려주기 위한 것이고 채점에는 쓰이지 않는다.
 */
export function typingState(input: string, answer: number): 'empty' | 'correct' | 'typing' | 'wrong' {
  if (!input) return 'empty';
  if (Number.parseInt(input, 10) === answer) return 'correct';
  return String(answer).indexOf(input) === 0 ? 'typing' : 'wrong';
}
