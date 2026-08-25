import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { cardmatch } from '../cardmatch';
import { SETS } from '../cardmatch/cardArt';
import { PAIRS, PREVIEW_MS, SET_COUNT, TARGET_PAIRS, makeBoards, normalize } from '../cardmatch/logic';

const Game = cardmatch.Component;
const SEED = 4242;
const LIMIT = 20;

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

/** 미리보기가 끝나고 실제로 플레이가 시작되는 시점까지 보낸다. */
function passPreview() {
  act(() => {
    jest.advanceTimersByTime(PREVIEW_MS);
  });
}

function runOutClock(extraMs = 0) {
  act(() => {
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
  it('세트 개수가 로직 상수와 일치한다', () => {
    expect(SETS.length).toBe(SET_COUNT);
  });

  it('모든 세트가 짝 수만큼 그림을 갖는다', () => {
    for (const set of SETS) {
      expect(set.icons).toHaveLength(PAIRS);
      expect(set.name).toBeTruthy();
    }
  });
});

describe('cardmatch 모듈 정보', () => {
  it('계약이 요구하는 정보를 모두 갖는다', () => {
    expect(cardmatch.info.id).toBe('cardmatch');
    expect(cardmatch.info.name).toBeTruthy();
    expect(cardmatch.info.emoji).toBeTruthy();
    expect(cardmatch.info.desc).toBeTruthy();
    expect(cardmatch.info.timeLimitSec).toBeGreaterThan(0);
  });
});

describe('cardmatch 화면', () => {
  it('첫 판을 12장으로 깔아준다', () => {
    render(<Game seed={SEED} timeLimitSec={LIMIT} onFinish={jest.fn()} />);
    for (let i = 0; i < PAIRS * 2; i++) {
      expect(screen.getByTestId(`card-${i}`)).toBeTruthy();
    }
  });

  it('제한시간이 지나면 스스로 종료한다', () => {
    const onFinish = jest.fn();
    render(<Game seed={SEED} timeLimitSec={LIMIT} onFinish={onFinish} />);

    passPreview();
    runOutClock();

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('미리보기 동안에는 시계가 흐르지 않는다', () => {
    const onFinish = jest.fn();
    render(<Game seed={SEED} timeLimitSec={LIMIT} onFinish={onFinish} />);

    // 미리보기 시간만 보내면 아직 끝나지 않아야 한다
    act(() => {
      jest.advanceTimersByTime(PREVIEW_MS);
    });
    expect(onFinish).not.toHaveBeenCalled();

    // 미리보기 이후로 제한시간을 꽉 채워야 끝난다
    act(() => {
      jest.advanceTimersByTime(LIMIT * 1000 - 1);
    });
    expect(onFinish).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(2);
    });
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('한 짝도 못 맞히면 0점으로 끝난다', () => {
    const onFinish = jest.fn();
    render(<Game seed={SEED} timeLimitSec={LIMIT} onFinish={onFinish} />);

    passPreview();
    runOutClock();

    expect(onFinish.mock.calls[0][0]).toMatchObject({
      score: 0,
      normalizedScore: 0,
    });
  });

  it('시간 초과여도 그때까지 맞힌 점수를 반환한다 (0점 처리 금지)', () => {
    const onFinish = jest.fn();
    render(<Game seed={SEED} timeLimitSec={LIMIT} onFinish={onFinish} />);

    passPreview();
    const [a, b] = firstPair();
    fireEvent.press(screen.getByTestId(`card-${a}`));
    fireEvent.press(screen.getByTestId(`card-${b}`));

    runOutClock();

    const result = onFinish.mock.calls[0][0];
    expect(result.score).toBe(1);
    expect(result.normalizedScore).toBeCloseTo(normalize(1));
  });

  it('맞힌 짝은 화면 카운터에도 반영된다', () => {
    render(<Game seed={SEED} timeLimitSec={LIMIT} onFinish={jest.fn()} />);

    passPreview();
    const [a, b] = firstPair();
    fireEvent.press(screen.getByTestId(`card-${a}`));
    fireEvent.press(screen.getByTestId(`card-${b}`));

    expect(screen.getByTestId('total')).toHaveTextContent('1');
  });

  it('종료 후 시간이 더 지나도 onFinish를 다시 부르지 않는다', () => {
    const onFinish = jest.fn();
    render(<Game seed={SEED} timeLimitSec={LIMIT} onFinish={onFinish} />);

    passPreview();
    runOutClock(60_000);

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('normalizedScore가 계약 범위 안에 있다', () => {
    const onFinish = jest.fn();
    render(<Game seed={SEED} timeLimitSec={LIMIT} onFinish={onFinish} />);

    passPreview();
    runOutClock();

    const { normalizedScore } = onFinish.mock.calls[0][0];
    expect(normalizedScore).toBeGreaterThanOrEqual(0);
    expect(normalizedScore).toBeLessThanOrEqual(100);
  });

  it('한 짝도 못 맞히면 tiebreak이 최하위가 되도록 제한시간을 준다', () => {
    const onFinish = jest.fn();
    render(<Game seed={SEED} timeLimitSec={LIMIT} onFinish={onFinish} />);

    passPreview();
    runOutClock();

    expect(onFinish.mock.calls[0][0].tiebreakMs).toBe(LIMIT * 1000);
  });

  it('목표치 정규화가 100을 넘지 않는다', () => {
    expect(normalize(TARGET_PAIRS * 3)).toBe(100);
  });
});
