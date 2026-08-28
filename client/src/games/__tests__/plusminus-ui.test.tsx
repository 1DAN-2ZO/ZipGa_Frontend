import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { plusminus } from '../plusminus';
import {
  WRONG_CLEAR_MS,
  makeQuestions,
  questionText,
} from '../plusminus/logic';

/**
 * 더하기 빼기 — 입력 화면 검사.
 *
 * 진짜 시계로 돌린다. 가짜 시계로는 자동 지우기와 겹쳐 결과가 불안정하다.
 *
 * 여기서 지키는 것은 하나다. **오타를 내도 그 문제를 계속 풀 수 있어야 한다.**
 * 예전에는 틀린 숫자가 그대로 남아 입력칸이 꽉 찼고, 그러면 정답을 칠 자리가 없어
 * 그 문제를 통째로 날렸다. 사용자에게는 "답을 쳤는데 점수가 안 오른다"로 보였다.
 */

const SEED = 4242;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 실제 타이핑처럼 지금 입력값 뒤에 한 글자를 덧붙인다. */
async function press(digit: string) {
  const box = screen.getByTestId('answer');
  fireEvent.changeText(box, String(box.props.value ?? '') + digit);
  await wait(50);
}

const typed = () => String(screen.getByTestId('answer').props.value ?? '');
const questionOnScreen = () => String(screen.getByTestId('question').props.children);

async function startGame() {
  await render(<plusminus.Component seed={SEED} timeLimitSec={20} onFinish={jest.fn()} />);
  return makeQuestions(SEED);
}

describe('더하기 빼기 입력', () => {
  afterEach(async () => {
    await cleanup();
  });

  it('정답으로 이어질 수 없는 입력은 스스로 비워진다', async () => {
    await startGame();

    await press('9');
    expect(typed()).toBe('9');

    await wait(WRONG_CLEAR_MS + 250);
    expect(typed()).toBe('');
  }, 30000);

  it('오타를 낸 뒤에도 그 문제를 풀 수 있다', async () => {
    const qs = await startGame();
    const first = questionText(qs[0]);

    await press('9');
    await wait(WRONG_CLEAR_MS + 250);

    for (const d of String(qs[0].answer)) await press(d);

    expect(questionOnScreen()).not.toBe(first);
  }, 30000);

  it('정답으로 가는 도중에는 입력이 지워지지 않는다', async () => {
    const qs = await startGame();
    const answer = String(qs[0].answer);
    if (answer.length < 2) return;               // 한 자리 답이면 도중이라는 게 없다

    await press(answer[0]);
    await wait(WRONG_CLEAR_MS + 250);            // 지우기 시간보다 오래 기다려도
    expect(typed()).toBe(answer[0]);             // 그대로 남아 있어야 한다
  }, 30000);
});
