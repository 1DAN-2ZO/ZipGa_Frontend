import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useGameSound } from '../../sound'
import type { GameModule, GameProps } from '../types';
import { COLORS } from '../../theme';
import {
  COUNTDOWN_MS,
  MAX_ANSWER_DIGITS,
  Question,
  WRONG_CLEAR_MS,
  makeQuestions,
  normalize,
  questionText,
  typingState,
} from './logic';

/**
 * 더하기 빼기 — 화면.
 *
 * 화면 구성
 *   [큰 숫자]         맞힌 문제 수
 *   ▓▓▓▓░░░          남은 시간
 *   ┌──────────┐
 *   │ 23 + 41  │     문제 칸. 카운트다운 동안엔 3·2·1 이 여기 뜬다
 *   └──────────┘     → 1번 문제를 미리 풀 수 없다
 *   ┌──────────┐
 *   │    64    │     입력창. 정답이 되는 순간 자동으로 다음 문제
 *   └──────────┘
 *
 * 뒤로 갈수록 숫자가 커진다. 자세한 단계는 logic.ts 의 TIERS 참고.
 *
 * 계약 준수:
 *  - Math.random() 없음. 문제는 seed 에서 파생 (logic.makeQuestions)
 *  - 네트워크 코드 없음
 *  - 제한시간이 끝나면 스스로 종료하고 그때까지의 점수를 반환 (0점 처리 안 함)
 *  - onFinish 는 정확히 한 번만 호출
 */

const C = {
  grape: '#7C5CFF',
  ink: '#2B1780',
  card: '#EFE9FF', cardDim: '#C6B4FF',
  white: '#FFFFFF',
  bad: '#FF5B4A', badBg: '#FFE2DE',
};

/** RN 에는 텍스트 외곽선이 없어서 같은 글자를 여러 번 겹쳐 찍는다. */
function Outlined({ text, size, color }: { text: string; size: number; color?: string }) {
  const OFF = Math.max(2, Math.round(size * 0.055));
  const dirs: [number, number][] = [
    [-OFF, 0], [OFF, 0], [0, -OFF], [0, OFF],
    [-OFF, -OFF], [OFF, -OFF], [-OFF, OFF], [OFF, OFF],
  ];
  const base = { fontSize: size, fontWeight: '900' as const, textAlign: 'center' as const };
  return (
    <View style={{ height: size * 1.15, justifyContent: 'center' }}>
      {dirs.map(([dx, dy], i) => (
        <Text
          key={i}
          style={[base, s.stack, { color: C.ink, transform: [{ translateX: dx }, { translateY: dy }] }]}
        >
          {text}
        </Text>
      ))}
      <Text style={[base, s.stack, { color: color ?? C.grape }]}>{text}</Text>
    </View>
  );
}

function PlusMinusGame({ seed, timeLimitSec, onFinish }: GameProps) {
  const sound = useGameSound()
  const limitMs = timeLimitSec * 1000;
  const questions = useMemo<Question[]>(() => makeQuestions(seed), [seed]);

  const [phase, setPhase] = useState<'count' | 'play' | 'over'>('count');
  const [countText, setCountText] = useState(String(Math.round(COUNTDOWN_MS / 1000)));
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

    const v = raw.replace(/[^0-9]/g, '').slice(0, MAX_ANSWER_DIGITS);
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
    setPhase('count');

    const steps = Math.round(COUNTDOWN_MS / 1000);
    setCountText(String(steps));
    for (let s = 1; s <= steps; s++) {
      later(() => {
        if (finishedRef.current) return;
        const rest = steps - s;
        setCountText(rest > 0 ? String(rest) : '시작!');
      }, s * 1000);
    }

    later(() => {
      if (finishedRef.current) return;
      setPhase('play');
      startedAtRef.current = Date.now();
      inputRef.current?.focus();
      tickRef.current = setInterval(() => {
        setLeft(Math.max(0, limitMs - (Date.now() - startedAtRef.current)));
      }, 100);
      later(finish, limitMs);
    }, COUNTDOWN_MS);

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
  const barColor = left <= 5000 ? C.bad : left <= 10000 ? COLORS.accent : C.grape;

  return (
    <View testID="game-root" style={s.wrap}>
      <View style={s.head}>
        <Outlined text={String(correct)} size={88} />
        <View style={s.subWrap}>
          <Outlined text={phase === 'count' ? '준비!' : '빨리 푸세요!'} size={19} />
        </View>
      </View>

      <View style={s.bar}>
        <View style={[s.barFill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>

      <View style={s.body}>
        {/* 문제 칸 — 카운트다운 동안엔 여기가 숫자로 채워져 문제가 안 보인다 */}
        <View style={[s.q, phase === 'count' && s.qCount]}>
          <Text
            testID="question"
            style={[
              s.qText,
              phase === 'count' && (countText === '시작!' ? s.qCountGo : s.qCountNum),
            ]}
          >
            {phase === 'count' ? countText : questionText(q)}
          </Text>
        </View>

        <TextInput
          testID="answer"
          ref={inputRef}
          style={[
            s.input,
            state === 'wrong' && s.inputWrong,
            phase !== 'play' && s.inputOff,
          ]}
          value={input}
          onChangeText={onChange}
          editable={phase === 'play'}
          keyboardType="number-pad"
          maxLength={MAX_ANSWER_DIGITS}
          textAlign="center"
          caretHidden={false}
          accessibilityLabel="정답 입력"
        />

        <Text style={s.hint}>
          {phase === 'count' ? '곧 시작합니다' : '정답을 입력하면 바로 넘어갑니다'}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, width: '100%', backgroundColor: COLORS.bg },
  stack: { position: 'absolute', left: 0, right: 0 },

  head: { paddingTop: 40, paddingHorizontal: 20 },
  subWrap: { marginTop: 10 },

  bar: {
    height: 12, marginHorizontal: 22, marginTop: 20,
    borderRadius: 99, backgroundColor: COLORS.surfaceAlt, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 99 },

  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, paddingHorizontal: 22 },

  q: {
    width: '100%', maxWidth: 340, paddingVertical: 26, paddingHorizontal: 20,
    borderRadius: 24, backgroundColor: C.card, borderWidth: 4, borderColor: C.grape,
    alignItems: 'center', justifyContent: 'center',
  },
  qCount: { backgroundColor: C.cardDim },
  qText: { fontSize: 48, fontWeight: '900', color: C.ink, textAlign: 'center' },
  qCountNum: { fontSize: 76 },
  qCountGo: { fontSize: 46 },

  input: {
    width: '100%', maxWidth: 340, paddingVertical: 18, borderRadius: 22,
    borderWidth: 4, borderColor: C.grape, backgroundColor: C.white,
    fontSize: 42, fontWeight: '900', color: C.ink,
  },
  inputWrong: { backgroundColor: C.badBg, borderColor: C.bad },
  inputOff: { backgroundColor: COLORS.surfaceAlt, borderColor: COLORS.border },

  hint: { color: COLORS.textMuted, fontSize: 13.5, fontWeight: '700', textAlign: 'center' },
});

export const plusminus: GameModule = {
  info: {
    id: 'plusminus',
    name: '더하기 빼기',
    emoji: '➕',
    desc: '제한시간 안에 덧셈·뺄셈을 최대한 많이',
    timeLimitSec: 20,
  },
  Component: PlusMinusGame,
};
