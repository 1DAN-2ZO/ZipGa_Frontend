import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { cardmatch } from '../cardmatch';
import { PREVIEW_MS, makeBoards } from '../cardmatch/logic';

/**
 * 카드 뒤집기 — 진짜 시계로 도는 검사.
 *
 * 이 게임은 카드를 누를 때마다 뒤집기 애니메이션 타이머가 걸린다.
 * 가짜 시계(jest.useFakeTimers)로 돌리면 그 타이머가 테스트 사이로 새어 나가
 * 다음 테스트의 화면을 깨뜨린다. 그래서 이 파일은 시계를 전혀 건드리지 않는다.
 *
 * 대신 제한시간을 1초로 줘서 몇 초 안에 끝나게 한다.
 * 실제 앱에서 벌어지는 일과 가장 가까운 검사다.
 */

const Game = cardmatch.Component;
const SEED = 4242;
const SHORT = 1;                          // 제한시간 1초

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 첫 판에서 짝이 맞는 카드 두 장의 인덱스 */
function firstPair(): [number, number] {
  const values = makeBoards(SEED)[0].values;
  const a = 0;
  const b = values.findIndex((v, i) => i !== a && v === values[a]);
  return [a, b];
}

/** 제한시간이 끝나 onFinish 가 불릴 때까지 기다린 뒤 그 결과를 준다. */
async function playOut(onFinish: jest.Mock) {
  await waitFor(() => expect(onFinish).toHaveBeenCalled(), { timeout: 15000, interval: 100 });
  return onFinish.mock.calls[0][0];
}

describe('cardmatch 화면 — 진짜 시계', () => {
  // 앞 테스트의 화면을 확실히 걷어낸다.
  // 자동 정리는 비동기라 다 끝나기 전에 다음 테스트가 시작되고,
  // 그러면 앞 게임이 아직 돌고 있어 새 게임의 시계가 흐르지 않는다.
  afterEach(async () => {
    await cleanup();
  });

  it('종료 후 시간이 더 지나도 onFinish를 다시 부르지 않는다', async () => {
    const onFinish = jest.fn();
    await render(<Game seed={SEED} timeLimitSec={SHORT} onFinish={onFinish} />);

    await playOut(onFinish);
    await wait(2000);                     // 끝난 뒤로 더 기다려 본다

    expect(onFinish).toHaveBeenCalledTimes(1);
  }, 30000);

  it('normalizedScore가 계약 범위 안에 있다', async () => {
    const onFinish = jest.fn();
    await render(<Game seed={SEED} timeLimitSec={SHORT} onFinish={onFinish} />);

    const { normalizedScore } = await playOut(onFinish);
    expect(normalizedScore).toBeGreaterThanOrEqual(0);
    expect(normalizedScore).toBeLessThanOrEqual(100);
  }, 30000);

  it('한 짝도 못 맞히면 tiebreak이 최하위가 되도록 제한시간을 준다', async () => {
    const onFinish = jest.fn();
    await render(<Game seed={SEED} timeLimitSec={SHORT} onFinish={onFinish} />);

    const { tiebreakMs } = await playOut(onFinish);
    expect(tiebreakMs).toBe(SHORT * 1000);
  }, 30000);

  /* 이 검사는 20초짜리 게임을 켜둔 채 끝나므로 반드시 맨 마지막에 둔다.
     앞에 두면 남은 게임이 계속 돌면서 뒤 테스트의 시계를 방해한다. */
  it('맞힌 짝은 화면 카운터에도 반영된다', async () => {
    await render(<Game seed={SEED} timeLimitSec={20} onFinish={jest.fn()} />);
    await wait(PREVIEW_MS + 300);         // 미리보기가 끝나기를 기다린다

    const [a, b] = firstPair();
    fireEvent.press(screen.getByTestId(`card-${a}`));
    fireEvent.press(screen.getByTestId(`card-${b}`));

    await waitFor(() => expect(screen.getByTestId('total')).toHaveTextContent('1'));
  }, 30000);
});
