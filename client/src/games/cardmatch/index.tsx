import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import type { GameModule, GameProps } from '../types';
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

const GAP = 8;

/* 카드 세로 / 가로 비율의 허용 범위.

   가로는 3장이 화면 폭을 꽉 채우는 순간 더 못 키운다.
   그래서 남는 위아래 공간을 세로로 써서 카드를 키운다.
   다만 끝없이 늘리면 카드가 젓가락처럼 길쭉해지므로 위아래로 한계를 둔다.
   (참고: 실제 트럼프 카드는 1.4) */
const RATIO_MIN = 1.20;
const RATIO_MAX = 1.55;

/** 이보다 작아지면 그림이 뭉개져서 못 알아본다. */
const MIN_CARD_W = 48;

/**
 * 들어갈 수 있는 최대 크기에서 살짝 줄이는 비율.
 *
 * 꽉 채우면 카드가 화면 가장자리에 닿아 답답해 보인다.
 * 조금 물러서면 격자가 한 덩어리로 읽힌다.
 */
const CARD_SCALE = 0.92;
const COLLECT_MS = 360;   // 다 맞춘 카드가 가운데로 모이는 시간
const CLEAR_HOLD_MS = 380; // "클리어!" 를 보여주는 시간
const DEAL_STAGGER = 30;

const C = {
  bg: '#15120E', surface: '#262019', surface2: '#312A21', line: '#3B3229',
  text: '#F6F1E7', text3: '#7D7263',
  soju: '#3FA063', sojuDim: '#1F4A31', amber: '#F0B44C', miss: '#D9614F',
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
  /** 미리보기 동안 머리에 뜨는 3·2·1. 플레이가 시작되면 빈 문자열이 된다. */
  const [countText, setCountText] = useState('');
  const [gridW, setGridW] = useState(() => Math.max(240, Dimensions.get('window').width - 36));
  const [gridH, setGridH] = useState(() => Math.max(240, Dimensions.get('window').height * 0.62));

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
  /**
   * 카드 뒤집기에 쓰는 회전·투명도 계산.
   *
   * 렌더할 때마다 새로 만들면 안 된다.
   * 남은 시간이 0.1초마다 바뀌면서 화면이 초당 10번 다시 그려지는데,
   * 그때마다 12장 × 4개 = 48개가 새로 붙어 초당 480개가 만들어진다.
   * 그만큼 화면이 끊기고 터치가 밀린다. 한 번 만들어 두고 계속 쓴다.
   */
  const A = useRef(
    Array.from({ length: CARD_COUNT }, () => ({
      flip: new Animated.Value(1), // 1 = 앞면, 0 = 뒷면
      tx: new Animated.Value(0),
      ty: new Animated.Value(0),
      sc: new Animated.Value(1),
      op: new Animated.Value(1),
    })),
  ).current;

  /** 카드 12장의 앞뒷면 회전·투명도. 컴포넌트가 사는 동안 한 벌만 쓴다. */
  const interp = useMemo(
    () =>
      A.map((a) => ({
        frontRot: a.flip.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] }),
        backRot: a.flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }),
        frontOp: a.flip.interpolate({ inputRange: [0, 0.5, 0.5001, 1], outputRange: [0, 0, 1, 1] }),
        backOp: a.flip.interpolate({ inputRange: [0, 0.5, 0.5001, 1], outputRange: [1, 1, 0, 0] }),
      })),
    [A],
  );

  /* 카드 크기.

     가로만 보고 키우면 화면이 넓을수록 카드가 커지고, 4줄이 세로로 넘쳐서
     아랫줄이 화면 밖으로 잘린다. 갤럭시처럼 폭이 넓은 기기에서 특히 심하다.
     가로 기준과 세로 기준을 각각 구해 **더 작은 쪽**에 맞춘다. */
  const byWidth = (gridW - GAP * (COLS - 1)) / COLS;

  /** 한 줄에게 돌아가는 세로 길이 */
  const rowH = gridH > 0 ? (gridH - GAP * ROWS) / ROWS : byWidth * RATIO_MAX;

  // 가장 납작한 카드를 기준으로 가로 한계를 잡는다. 그래야 가로를 최대한 쓴다.
  const fitW = Math.max(MIN_CARD_W, Math.min(byWidth, rowH / RATIO_MIN));

  // 세로는 남는 자리를 채우되, 너무 길쭉해지지 않게 자른다.
  const fitH = Math.min(Math.max(rowH, fitW * RATIO_MIN), fitW * RATIO_MAX);

  const cardW = Math.max(MIN_CARD_W, fitW * CARD_SCALE);
  const cardH = fitH * CARD_SCALE;

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
    setCountText('');                       // 카운트가 끝나면 맞춘 짝 수가 그 자리에 온다
    setBanner('같은 짝을 찾으세요!');
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

      // 다른 게임과 같은 3·2·1 카운트. 언제 덮이는지 알고 외울 수 있다.
      const steps = Math.round(PREVIEW_MS / 1000);
      setCountText(String(steps));
      for (let s = 1; s <= steps; s++) {
        later(() => {
          if (finishedRef.current) return;
          const rest = steps - s;
          setCountText(rest > 0 ? String(rest) : '!');
        }, s * 1000);
      }

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

  const cards = useMemo(
    () =>
      board.values.map((val, i) => {
        const a = A[i];
        const Icon = icons[val];
        const { frontRot, backRot, frontOp, backOp } = interp[i];

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
      }),
    [board, icons, done, cardW, cardH, tap, interp],
  );

  return (
    <View style={s.wrap}>
      {/* 머리 — 자를 잡아라와 같은 뼈대(큰 숫자 + 아래 안내 한 줄).
          큰 숫자 한 자리에 카운트다운과 남은 시간을 몰아넣었다.
          3 · 2 · 1 을 세고 나면 그 자리가 그대로 남은 시간으로 이어진다.
          카드 12장이 들어갈 자리를 남겨야 해서 자잡기보다 작게 잡았다. */}
      <View style={s.head}>
        <View style={s.headRow}>
          <Text
            testID="clock"
            style={[s.big, countText ? s.bigCount : null, { color: !countText && left <= 10000 ? urgent : C.text }]}
          >
            {countText || String(secs)}
          </Text>
          <View style={s.pairs}>
            <Text style={s.pairsKey}>맞춘 짝</Text>
            <Text testID="total" style={s.pairsVal}>{total}</Text>
          </View>
        </View>
        <Text testID="banner" style={s.sub}>{banner}</Text>
      </View>

      <View
        style={s.stage}
        onLayout={(e) => {
          const l = e.nativeEvent.layout;
          setGridW(l.width);
          setGridH(l.height);
        }}
      >
      <View style={[s.grid, { width: COLS * cardW + (COLS - 1) * GAP }]}>
        {cards}
      </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, width: '100%', paddingHorizontal: 10 },
  fill: { flex: 1 },

  /* 아래 세 덩이(머리 · 정보 칸 · 무대)는 자를 잡아라와 같은 크기·간격이다.
     한 세션에서 두 게임이 이어서 나올 때 화면이 튀지 않게 하려는 것이다. */
  head: { paddingTop: 20, paddingHorizontal: 10, alignItems: 'center' },
  /* 큰 숫자는 화면 한가운데에 둔다.
     맞춘 짝은 오른쪽에 띄워 놓아, 글자 수가 늘어도 가운데가 밀리지 않는다. */
  headRow: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  big: { fontSize: 56, fontWeight: '900', color: C.text, lineHeight: 62, textAlign: 'center' },
  bigCount: { fontSize: 72, lineHeight: 78 },
  pairs: { position: 'absolute', right: 0, bottom: 2, alignItems: 'flex-end' },
  pairsKey: { fontSize: 10, letterSpacing: 1.6, color: C.text3, marginBottom: 2 },
  pairsVal: { fontSize: 26, fontWeight: '800', color: C.text },
  sub: { fontSize: 17, fontWeight: '800', color: C.amber, marginTop: 6, height: 22, textAlign: 'center' },

  stage: { flex: 1, marginTop: 8, alignItems: 'center', justifyContent: 'center' },
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
