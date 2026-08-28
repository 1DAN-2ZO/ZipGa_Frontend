import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useGameSound } from '../../sound'
import type { GameModule, GameProps } from '../types';
import { useCompactLayout } from '../useCompactLayout';
import { COLORS } from '../../theme';
import { colors, fonts } from '../../theme/colors';
import {
  Question,
  TARGET_CORRECT,
  WRONG_CLEAR_MS,
  makeQuestions,
  normalize,
  typingState,
} from './logic';

/**
 * 구구단 — 화면.
 *
 * 화면 구성
 *   [큰 숫자]         맞힌 문제 수
 *   ▓▓▓▓░░░          남은 시간
 *   ┌──────────┐
 *   │  7 × 8   │     문제 칸
 *   └──────────┘
 *   ┌──────────┐
 *   │    56    │     입력창. 정답이 되는 순간 자동으로 다음 문제
 *   └──────────┘
 *
 * 계약 준수:
 *  - Math.random() 없음. 문제는 seed 에서 파생 (logic.makeQuestions)
 *  - 네트워크 코드 없음
 *  - 제한시간이 끝나면 스스로 종료하고 그때까지의 점수를 반환 (0점 처리 안 함)
 *  - onFinish 는 정확히 한 번만 호출
 */

function GugudanGame({ seed, timeLimitSec, onFinish }: GameProps) {
  const sound = useGameSound()
  // 키보드가 올라오면 자리가 절반으로 준다. 그때 접을 것들을 이 값이 정한다.
  const { compact, onLayout } = useCompactLayout()
  const limitMs = timeLimitSec * 1000;
  const questions = useMemo<Question[]>(() => makeQuestions(seed), [seed]);

  const [phase, setPhase] = useState<'play' | 'over'>('play');
  const [qIdx, setQIdx] = useState(0);
  const [input, setInput] = useState('');
  const [correct, setCorrect] = useState(0);
  const [left, setLeft] = useState(limitMs);

  const correctRef = useRef(0);
  const qIdxRef = useRef(0);
  const startedAtRef = useRef(0);
  const lastCorrectRef = useRef<number | null>(null);
  const finishedRef = useRef(false);
  const inputRef = useRef<TextInput>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const wrongTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
    return t;
  }, []);

  /* ---------- 종료 ---------- */
  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setPhase('over');
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    wrongTimerRef.current = null;
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    setLeft(0);
    inputRef.current?.blur();

    onFinish({
      normalizedScore: normalize(correctRef.current),
      score: correctRef.current,                      // 맞힌 문제 수 (화면 표시용)
      // 동점이면 그 개수에 먼저 도달한 쪽이 위. 한 문제도 못 맞혔으면 최하위.
      tiebreakMs: lastCorrectRef.current ?? limitMs,
      finished: true,                                 // 제한시간을 끝까지 쓰는 것이 정상 종료다
    });
  }, [onFinish, limitMs]);

  /* ---------- 입력 ---------- */
  const onChange = useCallback((raw: string) => {
    if (finishedRef.current) return;

    // 지우기 예약이 걸려 있으면 먼저 취소한다. 치는 도중에 입력이 사라지면 안 된다.
    if (wrongTimerRef.current) {
      clearTimeout(wrongTimerRef.current);
      wrongTimerRef.current = null;
    }

    const v = raw.replace(/[^0-9]/g, '').slice(0, 2);
    const answer = questions[qIdxRef.current].answer;

    if (v && Number.parseInt(v, 10) === answer) {
      sound.hit();
      correctRef.current += 1;
      lastCorrectRef.current = Date.now() - startedAtRef.current;
      setCorrect(correctRef.current);
      qIdxRef.current = (qIdxRef.current + 1) % questions.length;
      setQIdx(qIdxRef.current);
      setInput('');
      return;
    }
    setInput(v);

    /* 정답으로 이어질 수 없는 입력이면 잠깐 보여준 뒤 스스로 비운다.
       그냥 두면 입력칸이 꽉 차서 그 문제를 영영 못 푼다.
       (오타 한 번에 한 문제를 통째로 날리던 문제) */
    if (typingState(v, answer) === 'wrong') {
      wrongTimerRef.current = later(() => {
        wrongTimerRef.current = null;
        if (finishedRef.current) return;
        setInput('');
      }, WRONG_CLEAR_MS);
    }
  }, [questions, later]);

  /* ---------- 시작 / 정리 ---------- */
  useEffect(() => {
    // seed 가 바뀌면 처음부터 다시 시작한다 (호스트가 재마운트하지 않는 경우 대비)
    finishedRef.current = false;
    correctRef.current = 0;
    qIdxRef.current = 0;
    lastCorrectRef.current = null;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    wrongTimerRef.current = null;
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    setCorrect(0); setQIdx(0); setInput(''); setLeft(limitMs);
    setPhase('play');
    startedAtRef.current = Date.now();
    inputRef.current?.focus();
    tickRef.current = setInterval(() => {
      setLeft(Math.max(0, limitMs - (Date.now() - startedAtRef.current)));
    }, 100);
    later(finish, limitMs);

    return () => {
      finishedRef.current = true;
      timersRef.current.forEach(clearTimeout);
      if (tickRef.current) clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, limitMs]);

  /* ---------- 렌더 ---------- */
  const q = questions[qIdx];
  const state = phase === 'play' ? typingState(input, q.answer) : 'empty';
  const pct = (left / limitMs) * 100;
  const barColor = left <= 5000 ? COLORS.bad : left <= 10000 ? COLORS.accent : COLORS.good;

  return (
    <View testID="game-root" style={s.wrap} onLayout={onLayout}>
      <View style={[s.head, compact && s.headCompact]}>
        <Text style={[s.scoreText, compact && s.scoreTextCompact]}>{correct}</Text>
        {/* 자리가 급하면 응원 문구부터 접는다 */}
        {!compact && (
          <View style={s.subWrap}>
            <Text style={s.subText}>빨리 푸세요!</Text>
          </View>
        )}
      </View>

      <View style={s.bar}>
        <View style={[s.barFill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>

      <View style={[s.body, compact && s.bodyCompact]}>
        {/* 위아래 여백이 남는 자리를 반씩 먹어 가운데로 모은다. 자리가 모자라면
            0까지 줄어들고, 그때는 내용이 위에서부터 쌓여 아래로만 넘친다. */}
        <View style={s.gap} />

        <View style={s.q}>
          <Text testID="question" style={[s.qText, compact && s.qTextCompact]}>
            {`${q.a} × ${q.b}`}
          </Text>
        </View>

        <TextInput
          testID="answer"
          ref={inputRef}
          style={[
            s.input,
            compact && s.inputCompact,
            state === 'wrong' && s.inputWrong,
            phase !== 'play' && s.inputOff,
          ]}
          value={input}
          onChangeText={onChange}
          editable={phase === 'play'}
          keyboardType="number-pad"
          maxLength={2}
          textAlign="center"
          caretHidden={false}
          accessibilityLabel="정답 입력"
        />

        {!compact && <Text style={s.hint}>정답을 입력하면 바로 넘어갑니다</Text>}

        <View style={s.gap} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, width: '100%', backgroundColor: COLORS.bg },

  head: { paddingTop: 40, paddingHorizontal: 20 },
  scoreText: { fontFamily: fonts.heading, fontSize: 112, color: colors.primary, textAlign: 'center' },
  subWrap: { marginTop: 10 },
  subText: { fontFamily: fonts.bold, fontSize: 19, color: COLORS.accent, textAlign: 'center' },

  bar: {
    height: 12, marginHorizontal: 22, marginTop: 20,
    borderRadius: 99, backgroundColor: COLORS.surfaceAlt, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 99 },

  /**
   * 문제 칸과 입력창이 사는 영역.
   *
   * justifyContent:'center'를 안 쓴다. body는 flex:1이라 자리가 모자라면 제
   * 내용보다도 작아지는데, 그 상태의 가운데 정렬은 넘치는 만큼을 위아래로
   * 똑같이 밀어내서 위로 삐져나온 문제 칸이 시간 막대를 덮었다.
   *
   * 대신 위아래에 늘었다 줄어드는 여백(gap)을 하나씩 둔다. 자리가 남으면
   * 반씩 먹어 가운데로 모으고, 모자라면 0까지 줄어들어 내용에 자리를 내준다.
   * 그때는 위에서부터 쌓이므로 넘쳐도 아래로만 간다.
   *
   * paddingTop은 그 여백이 0이 된 순간에도 시간 막대에 딱 붙지 않게 하는 몫이다.
   */
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 18,
    paddingHorizontal: 22,
    paddingTop: 14,
  },
  /** 남는 자리를 먹는 여백. 모자라면 0까지 줄어든다 */
  gap: { flex: 1 },

  /**
   * 키보드가 올라온 동안 쓰는 축소본.
   *
   * bodyCompact의 flex-start가 핵심이다. body는 flex:1이라 자리가 모자라면
   * 제 내용보다도 작아지는데, 그 상태에서 가운데 정렬이면 넘치는 만큼이
   * 위아래로 똑같이 삐져나온다 — 위로 삐져나온 문제 칸이 시간 막대를
   * 덮어버렸다(제보된 겹침). 위에서부터 쌓으면 넘쳐도 아래로만 간다.
   *
   * 그 위에 머리를 접어 자리를 만든다. 점수 112는 키보드가 없을 때나
   * 되는 크기다.
   */
  headCompact: { paddingTop: 12 },
  scoreTextCompact: { fontSize: 44 },
  bodyCompact: { gap: 12 },
  qTextCompact: { fontSize: 34 },
  inputCompact: { paddingVertical: 12, fontSize: 32 },

  q: {
    width: '100%', maxWidth: 340, paddingVertical: 26, paddingHorizontal: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  qText: { fontSize: 52, fontWeight: '900', color: COLORS.text, textAlign: 'center' },

  input: {
    width: '100%', maxWidth: 340, paddingVertical: 18, borderRadius: 22,
    borderWidth: 4, borderColor: COLORS.accent, backgroundColor: COLORS.surface,
    fontSize: 42, fontWeight: '900', color: COLORS.text,
  },
  inputWrong: { borderColor: COLORS.bad },
  inputOff: { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border },

  hint: { color: COLORS.textMuted, fontSize: 13.5, fontWeight: '700', textAlign: 'center' },
});

export const gugudan: GameModule = {
  info: {
    id: 'gugudan',
    name: '구구단',
    emoji: '✖️',
    desc: '제한시간 안에 곱셈 문제를 최대한 많이',
    timeLimitSec: 20,
  },
  Component: GugudanGame,
};
