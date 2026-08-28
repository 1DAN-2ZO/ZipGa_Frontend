import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
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

/**
 * 키보드가 올라오면 문제 칸이 시간 막대를 덮던 문제.
 *
 * body가 flex:1이라 자리가 모자라면 제 내용보다도 작아지는데, 그 상태에서
 * 가운데 정렬이면 넘치는 만큼이 위아래로 똑같이 삐져나온다 — 위로 삐져나온
 * 문제 칸이 시간 막대를 78px 덮었다(실제 폰 제보, 웹 390x430에서 재현).
 *
 * 여기서 지키는 것은 하나다. **자리가 좁아져도 위로는 넘치지 않는다.**
 */
describe('더하기 빼기 — 키보드가 올라왔을 때', () => {
  const layout = async (height: number) => {
    fireEvent(screen.getByTestId('game-root'), 'layout', {
      nativeEvent: { layout: { width: 390, height } },
      persist: () => {},
    });
    await wait(20);
  };

  const styleOf = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style);

  /** 문제 칸을 담고 있는 영역(body). 넘칠 때 어느 쪽으로 밀리는지가 여기서 정해진다. */
  const bodyStyle = () => {
    const card = screen.getByTestId('question').parent;
    const body = card?.parent;
    if (!body) throw new Error('문제 칸을 담은 영역을 찾지 못했습니다.');
    return StyleSheet.flatten(body.props.style);
  };

  it('가운데 정렬을 쓰지 않는다 — 넘칠 때 위로 밀어내는 원인이었다', async () => {
    await startGame();

    await layout(430);
    expect(bodyStyle().justifyContent).toBe('flex-start');

    // 자리가 넉넉해도 마찬가지다. 가운데로 모으는 일은 여백 뷰가 맡는다.
    await layout(844);
    expect(bodyStyle().justifyContent).toBe('flex-start');
  });

  it('내용 위아래에 줄어드는 여백을 둬 자리가 남으면 가운데로 모은다', async () => {
    await startGame();

    await layout(844);

    // 문제 칸 앞뒤로 flex:1 여백이 하나씩. 자리가 모자라면 0까지 줄어든다.
    const card = screen.getByTestId('question').parent;
    const body = card?.parent;
    const spacers = (body?.children ?? []).filter(
      (child) =>
        typeof child !== 'string' &&
        StyleSheet.flatten(child.props.style)?.flex === 1,
    );
    expect(spacers).toHaveLength(2);
  });

  it('여백이 0이 돼도 시간 막대에 딱 붙지 않는다', async () => {
    await startGame();

    await layout(430);

    expect(bodyStyle().paddingTop).toBeGreaterThan(0);
  });

  it('좁아지면 점수와 문제 글자를 줄여 자리를 만든다', async () => {
    await startGame();

    await layout(844);
    const roomy = styleOf('question').fontSize;
    await layout(430);
    const tight = styleOf('question').fontSize;

    expect(tight).toBeLessThan(roomy);
  });

  it('좁아져도 문제와 입력칸은 그대로 남는다', async () => {
    const questions = await startGame();

    await layout(430);

    expect(screen.getByTestId('question')).toHaveTextContent(questionText(questions[0]));
    expect(screen.getByTestId('answer')).toBeTruthy();
  });

  it('응원 문구는 접는다', async () => {
    await startGame();

    await layout(430);

    expect(screen.queryByText('빨리 푸세요!')).toBeNull();
  });
});
