import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import { cardmatch } from '../cardmatch';
import { SETS } from '../cardmatch/cardArt';
import { PAIRS, PREVIEW_MS, SET_COUNT, TARGET_PAIRS, makeBoards, normalize } from '../cardmatch/logic';

const Game = cardmatch.Component;
const SEED = 4242;
const LIMIT = 20;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(async () => {
  // 앞 테스트의 화면과 예약된 타이머를 먼저 걷어낸다.
  // 이 순서가 아니면 남은 타이머가 다음 테스트로 새어 들어간다.
  await cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});

/** 미리보기가 끝나고 실제로 플레이가 시작되는 시점까지 보낸다. */
async function passPreview() {
  await act(async () => {
    jest.advanceTimersByTime(PREVIEW_MS);
  });
}

/** 눌린 결과가 화면에 반영될 때까지 아주 짧게 시계를 돌린다. */
async function flush() {
  await act(async () => {
    jest.advanceTimersByTime(50);
  });
}

async function runOutClock(extraMs = 0) {
  await act(async () => {
    jest.advanceTimersByTime(LIMIT * 1000 + extraMs);
  });
}

/** 첫 판에서 짝이 맞는 카드 두 장의 인덱스 */
function firstPair(): [number, number] {
  const values = makeBoards(SEED)[0].values;
  const a = 0;
  const b = values.findIndex((v, i) => i !== a && v === values[a]);
  return [a, b];
}

describe('카드 아트', () => {
  it('세트 개수가 로직 상수와 일치한다', async () => {
    expect(SETS.length).toBe(SET_COUNT);
  });

  it('모든 세트가 짝 수만큼 그림을 갖는다', async () => {
    for (const set of SETS) {
      expect(set.icons).toHaveLength(PAIRS);
      expect(set.name).toBeTruthy();
    }
  });
});

describe('cardmatch 모듈 정보', () => {
  it('계약이 요구하는 정보를 모두 갖는다', async () => {
    expect(cardmatch.info.id).toBe('cardmatch');
    expect(cardmatch.info.name).toBeTruthy();
    expect(cardmatch.info.emoji).toBeTruthy();
    expect(cardmatch.info.desc).toBeTruthy();
    expect(cardmatch.info.timeLimitSec).toBeGreaterThan(0);
  });
});

describe('cardmatch 화면', () => {
  it('첫 판을 12장으로 깔아준다', async () => {
    await render(<Game seed={SEED} timeLimitSec={LIMIT} onFinish={jest.fn()} />);
    for (let i = 0; i < PAIRS * 2; i++) {
      expect(screen.getByTestId(`card-${i}`)).toBeTruthy();
    }
  });

  it('제한시간이 지나면 스스로 종료한다', async () => {
    const onFinish = jest.fn();
    await render(<Game seed={SEED} timeLimitSec={LIMIT} onFinish={onFinish} />);

    await passPreview();
    await runOutClock();

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('미리보기 동안에는 시계가 흐르지 않는다', async () => {
    const onFinish = jest.fn();
    await render(<Game seed={SEED} timeLimitSec={LIMIT} onFinish={onFinish} />);

    // 미리보기 시간만 보내면 아직 끝나지 않아야 한다
    await act(async () => {
      jest.advanceTimersByTime(PREVIEW_MS);
    });
    expect(onFinish).not.toHaveBeenCalled();

    // 미리보기 이후로 제한시간을 꽉 채워야 끝난다
    await act(async () => {
      jest.advanceTimersByTime(LIMIT * 1000 - 1);
    });
    expect(onFinish).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(2);
    });
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('한 짝도 못 맞히면 0점으로 끝난다', async () => {
    const onFinish = jest.fn();
    await render(<Game seed={SEED} timeLimitSec={LIMIT} onFinish={onFinish} />);

    await passPreview();
    await runOutClock();

    expect(onFinish.mock.calls[0][0]).toMatchObject({
      score: 0,
      normalizedScore: 0,
    });
  });

  it('시간 초과여도 그때까지 맞힌 점수를 반환한다 (0점 처리 금지)', async () => {
    const onFinish = jest.fn();
    await render(<Game seed={SEED} timeLimitSec={LIMIT} onFinish={onFinish} />);

    await passPreview();
    const [a, b] = firstPair();
    fireEvent.press(screen.getByTestId(`card-${a}`));
    fireEvent.press(screen.getByTestId(`card-${b}`));

    await runOutClock();

    const result = onFinish.mock.calls[0][0];
    expect(result.score).toBe(1);
    expect(result.normalizedScore).toBeCloseTo(normalize(1));
  });

  it('목표치 정규화가 100을 넘지 않는다', async () => {
    expect(normalize(TARGET_PAIRS * 3)).toBe(100);
  });
});
