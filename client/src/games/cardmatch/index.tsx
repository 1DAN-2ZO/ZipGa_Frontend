import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import type { GameModule, GameProps } from '../types';
import { COLORS } from '../../theme';
import { SETS } from './cardArt';
import {
  Board,
  CARD_COUNT,
  COLS,
  FLIPBACK_MS,
  PAIRS,
  PREVIEW_MS,
  ROWS,
  makeBoards,
  normalize,
} from './logic';

/**
 * 카드 뒤집기 — 화면.
 *
 * 규칙: 제한시간 안에 짝을 최대한 많이 맞춘다. 6짝을 다 맞추면 새 판이 이어진다.
 * 판 시작 미리보기(2초) 동안에는 제한시간이 멈춘다. 안 그러면 판을 깰수록
 * 미리보기에 시간을 뺏겨서 잘하는 사람이 손해를 본다.
 *
 * 계약 준수:
 *  - Math.random() 없음. 모든 배치는 seed 에서 파생 (logic.makeBoards)
 *  - 네트워크 코드 없음
 *  - 시간이 끝나면 스스로 종료하고 그때까지의 점수를 반환 (0점 처리 안 함)
 *  - onFinish 는 정확히 한 번만 호출
 */

const GAP = 10;
const COLLECT_MS = 360;   // 다 맞춘 카드가 가운데로 모이는 시간
const CLEAR_HOLD_MS = 380; // "클리어!" 를 보여주는 시간
const DEAL_STAGGER = 30;

/**
 * 뒤집기 전 카드(cardBack)의 짙은 초록만 이 게임의 것으로 남기고,
 * 나머지 판·글씨는 공통 톤(theme.ts COLORS)을 따른다.
 * 예전엔 어두운 배경 전용이라 크림색 글씨를 썼는데, 호스트 배경이 밝아서
 * 글씨가 배경에 묻혔다.
 */
const C = {
  surface: COLORS.surfaceAlt, surface2: COLORS.surface, line: COLORS.border,
  text: COLORS.text, text3: COLORS.textMuted,
  soju: COLORS.good, sojuDim: '#D9F0E3', amber: COLORS.accent, miss: COLORS.bad,
  cardBack: '#2C4A38', cardBackEdge: '#3C6349',
};

function CardMatchGame({ seed, timeLimitSec, onFinish }: GameProps) {
  const limitMs = timeLimitSec * 1000;
  const boards = useMemo<Board[]>(() => makeBoards(seed), [seed]);

  const [boardIdx, setBoardIdx] = useState(0);
  const [done, setDone] = useState<boolean[]>(() => new Array(CARD_COUNT).fill(false));
  const [total, setTotal] = useState(0);
  const [left, setLeft] = useState(limitMs);
  const [banner, setBanner] = useState('');
  const [gridW, setGridW] = useState(() => Math.max(240, Dimensions.get('window').width - 36));

  // --- 렌더에 영향 없는 값 ---
  const seenRef = useRef<boolean[]>(new Array(CARD_COUNT).fill(false));
  const openRef = useRef<number[]>([]);
  const lockRef = useRef(true);
  const matchedRef = useRef(0);
  const totalRef = useRef(0);
  const boardIdxRef = useRef(0);
  const lastMatchRef = useRef<number | null>(null);
  const finishedRef = useRef(false);

  // --- 시계 (미리보기 동안 정지) ---
  const elapsedRef = useRef(0);
  const segStartRef = useRef(0);
  const runningRef = useRef(false);
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
    return t;
  }, []);

  const playMs = useCallback(
    () => elapsedRef.current + (runningRef.current ? Date.now() - segStartRef.current : 0),
    [],
  );

  // --- 애니메이션 값 (카드 12장 고정) ---
  const A = useRef(
    Array.from({ length: CARD_COUNT }, () => ({
      flip: new Animated.Value(1), // 1 = 앞면, 0 = 뒷면
      tx: new Animated.Value(0),
      ty: new Animated.Value(0),
      sc: new Animated.Value(1),
      op: new Animated.Value(1),
    })),
  ).current;

  const cardW = (gridW - GAP * (COLS - 1)) / COLS;
  const cardH = cardW * 1.34;

  const offset = useCallback(
    (i: number) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = (COLS * cardW + (COLS - 1) * GAP) / 2;
      const cy = (ROWS * cardH + (ROWS - 1) * GAP) / 2;
      return {
        dx: cx - (col * (cardW + GAP) + cardW / 2),
        dy: cy - (row * (cardH + GAP) + cardH / 2),
      };
    },
    [cardW, cardH],
  );

  /* ---------- 종료 ---------- */
  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    lockRef.current = true;

    if (runningRef.current) {
      elapsedRef.current += Date.now() - segStartRef.current;
      runningRef.current = false;
    }
    if (endTimerRef.current) { clearTimeout(endTimerRef.current); endTimerRef.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setLeft(0);

    onFinish({
      normalizedScore: normalize(totalRef.current),
      score: totalRef.current,
      // 동점이면 마지막 성공이 빠른 쪽이 위. 한 짝도 못 맞췄으면 최하위가 되도록 제한시간을 준다.
      tiebreakMs: lastMatchRef.current ?? limitMs,
      // 이 게임은 제한시간을 다 쓰는 것이 정상 종료다 (중도 완주 상태가 없다).
      finished: true,
    });
  }, [onFinish, limitMs]);

  const pauseClock = useCallback(() => {
    if (!runningRef.current) return;
    elapsedRef.current += Date.now() - segStartRef.current;
    runningRef.current = false;
    if (endTimerRef.current) { clearTimeout(endTimerRef.current); endTimerRef.current = null; }
  }, []);

  const resumeClock = useCallback(() => {
    if (runningRef.current || finishedRef.current) return;
    segStartRef.current = Date.now();
    runningRef.current = true;
    endTimerRef.current = setTimeout(finish, Math.max(0, limitMs - elapsedRef.current));
  }, [finish, limitMs]);

  /* ---------- 애니메이션 ---------- */
  const flipTo = useCallback(
    (ids: number[], up: boolean, duration = 300) => {
      Animated.parallel(
        ids.map((i) =>
          Animated.timing(A[i].flip, { toValue: up ? 1 : 0, duration, useNativeDriver: true }),
        ),
      ).start();
    },
    [A],
  );

  const collectCards = useCallback(() => {
    A.forEach((a, i) => {
      const { dx, dy } = offset(i);
      Animated.parallel([
        Animated.timing(a.tx, { toValue: dx, duration: COLLECT_MS, useNativeDriver: true }),
        Animated.timing(a.ty, { toValue: dy, duration: COLLECT_MS, useNativeDriver: true }),
        Animated.timing(a.sc, { toValue: 0.5, duration: COLLECT_MS, useNativeDriver: true }),
        Animated.timing(a.op, { toValue: 0, duration: 240, delay: 100, useNativeDriver: true }),
      ]).start();
    });
  }, [A, offset]);

  const dealCards = useCallback(() => {
    A.forEach((a, i) => {
      const { dx, dy } = offset(i);
      a.flip.setValue(1); // 새 카드는 앞면으로 깔린다
      a.tx.setValue(dx); a.ty.setValue(dy);
      a.sc.setValue(0.5); a.op.setValue(0);
    });
    Animated.stagger(
      DEAL_STAGGER,
      A.map((a) =>
        Animated.parallel([
          Animated.timing(a.tx, { toValue: 0, duration: 400, useNativeDriver: true }),
          Animated.timing(a.ty, { toValue: 0, duration: 400, useNativeDriver: true }),
          Animated.timing(a.sc, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(a.op, { toValue: 1, duration: 180, useNativeDriver: true }),
        ]),
      ),
    ).start();
  }, [A, offset]);

  /* ---------- 판 진행 ---------- */
  const startPlay = useCallback(() => {
    if (finishedRef.current) return;
    flipTo(A.map((_, i) => i), false);
    setBanner('');
    lockRef.current = false;
    resumeClock();
  }, [A, flipTo, resumeClock]);

  const openBoard = useCallback(
    (idx: number) => {
      if (finishedRef.current) return;
      const board = boards[Math.min(idx, boards.length - 1)];
      matchedRef.current = 0;
      openRef.current = [];
      seenRef.current = new Array(CARD_COUNT).fill(false);
      boardIdxRef.current = idx;
      setBoardIdx(idx);
      setDone(new Array(CARD_COUNT).fill(false));
      setBanner(`${SETS[board.setIndex].name} · 외우세요!`);
      dealCards();
      later(startPlay, PREVIEW_MS);
    },
    [boards, dealCards, later, startPlay],
  );

  /* ---------- 탭 ---------- */
  const tap = useCallback(
    (id: number) => {
      if (lockRef.current || finishedRef.current) return;
      if (openRef.current.includes(id)) return;
      if (done[id]) return;

      const now = playMs();
      flipTo([id], true, 240);
      openRef.current.push(id);
      if (openRef.current.length < 2) return;

      lockRef.current = true;
      const [ia, ib] = openRef.current;
      const values = boards[Math.min(boardIdxRef.current, boards.length - 1)].values;

      if (values[ia] === values[ib]) {
        matchedRef.current += 1;
        totalRef.current += 1;
        lastMatchRef.current = now;
        seenRef.current[ia] = seenRef.current[ib] = true;
        setTotal(totalRef.current);
        setDone((prev) => prev.map((d, i) => (i === ia || i === ib ? true : d)));
        openRef.current = [];

        if (matchedRef.current === PAIRS) {
          pauseClock();
          setBanner('클리어!');
          later(() => {
            collectCards();
            later(() => openBoard(boardIdxRef.current + 1), COLLECT_MS);
          }, CLEAR_HOLD_MS);
          return;
        }
        lockRef.current = false;
        return;
      }

      seenRef.current[ia] = seenRef.current[ib] = true;
      later(() => {
        flipTo([ia, ib], false, 240);
        openRef.current = [];
        lockRef.current = false;
      }, FLIPBACK_MS);
    },
    [done, boards, playMs, flipTo, pauseClock, collectCards, openBoard, later],
  );

  /* ---------- 시작 / 정리 ----------
     seed 가 바뀌면 스스로 처음부터 다시 시작한다.
     호스트가 판마다 key 로 재마운트해 주면 이 경로는 안 쓰이지만,
     같은 컴포넌트에 seed 만 바꿔 넣는 방식이어도 정상 동작하도록 대비해 둔다. */
  useEffect(() => {
    finishedRef.current = false;
    lockRef.current = true;
    openRef.current = [];
    matchedRef.current = 0;
    totalRef.current = 0;
    boardIdxRef.current = 0;
    lastMatchRef.current = null;
    elapsedRef.current = 0;
    runningRef.current = false;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    if (endTimerRef.current) { clearTimeout(endTimerRef.current); endTimerRef.current = null; }
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }

    setTotal(0);
    setLeft(limitMs);

    openBoard(0);
    tickRef.current = setInterval(() => {
      setLeft(Math.max(0, limitMs - playMs()));
    }, 100);

    return () => {
      finishedRef.current = true;
      if (tickRef.current) clearInterval(tickRef.current);
      if (endTimerRef.current) clearTimeout(endTimerRef.current);
      timersRef.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, limitMs]);

  /* ---------- 렌더 ---------- */
  const secs = Math.ceil(left / 1000);
  const urgent = left <= 5000 ? C.miss : left <= 10000 ? C.amber : C.soju;
  const board = boards[Math.min(boardIdx, boards.length - 1)];
  const icons = SETS[board.setIndex].icons;

  return (
    <View testID="game-root" style={s.wrap}>
      <View style={s.hud}>
        <Text testID="clock" style={[s.clock, { color: left <= 10000 ? urgent : C.text }]}>
          {secs}
        </Text>
        <View style={s.cell}>
          <Text style={s.key}>판</Text>
          <Text testID="board" style={[s.val, { color: C.amber }]}>{boardIdx + 1}</Text>
        </View>
        <View style={[s.cell, s.right]}>
          <Text style={s.key}>맞춘 짝</Text>
          <Text testID="total" style={s.val}>{total}</Text>
        </View>
      </View>

      <View style={s.bar}>
        <View style={[s.barFill, { width: `${(left / limitMs) * 100}%`, backgroundColor: urgent }]} />
      </View>

      <Text testID="banner" style={s.banner}>{banner}</Text>

      <View style={s.grid} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
        {board.values.map((val, i) => {
          const a = A[i];
          const Icon = icons[val];
          const frontRot = a.flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
          const backRot = a.flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
          const frontOp = a.flip.interpolate({ inputRange: [0, 0.5, 0.5001, 1], outputRange: [0, 0, 1, 1] });
          const backOp = a.flip.interpolate({ inputRange: [0, 0.5, 0.5001, 1], outputRange: [1, 1, 0, 0] });

          return (
            <Animated.View
              key={i}
              style={{
                width: cardW, height: cardH, marginBottom: GAP,
                opacity: a.op,
                transform: [{ translateX: a.tx }, { translateY: a.ty }, { scale: a.sc }],
              }}
            >
              <Pressable
                testID={`card-${i}`}
                onPress={() => tap(i)}
                disabled={done[i]}
                style={s.fill}
                accessibilityLabel={`카드 ${i + 1}`}
              >
                <Animated.View
                  style={[s.face, s.back, { opacity: backOp, transform: [{ perspective: 800 }, { rotateY: backRot }] }]}
                >
                  <View style={[s.mark, { width: cardW * 0.26, height: cardW * 0.36 }]} />
                </Animated.View>
                <Animated.View
                  style={[
                    s.face, s.front, done[i] && s.frontDone,
                    { opacity: frontOp, transform: [{ perspective: 800 }, { rotateY: frontRot }] },
                  ]}
                >
                  <Icon size={cardW * 0.62} />
                </Animated.View>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, width: '100%', paddingHorizontal: 18, backgroundColor: COLORS.bg },
  fill: { flex: 1 },
  hud: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  clock: { fontSize: 38, fontWeight: '800', minWidth: 58 },
  cell: { paddingLeft: 14, borderLeftWidth: 1, borderLeftColor: C.line },
  right: { marginLeft: 'auto', alignItems: 'flex-end', borderLeftWidth: 0 },
  key: { fontSize: 10, letterSpacing: 1.6, color: C.text3, marginBottom: 2 },
  val: { fontSize: 24, fontWeight: '800', color: C.text },
  bar: { height: 5, backgroundColor: C.surface, borderRadius: 99, overflow: 'hidden', marginBottom: 14 },
  barFill: { height: '100%', borderRadius: 99 },
  banner: { textAlign: 'center', color: C.amber, fontSize: 16, fontWeight: '700', height: 24, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  face: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  back: { backgroundColor: C.cardBack, borderColor: C.cardBackEdge },
  mark: { borderWidth: 2, borderColor: 'rgba(160,220,180,0.34)', borderRadius: 4 },
  front: { backgroundColor: C.surface2, borderColor: C.line },
  frontDone: { backgroundColor: C.sojuDim, borderColor: C.soju },
});

export const cardmatch: GameModule = {
  info: {
    id: 'cardmatch',
    name: '카드 뒤집기',
    emoji: '🃏',
    desc: '제한시간 안에 같은 짝을 몇 개나 찾을 수 있나',
    timeLimitSec: 20,
  },
  Component: CardMatchGame,
};
