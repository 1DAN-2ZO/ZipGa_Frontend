import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import { useGameSound } from '../../sound'
import type { GameModule, GameProps } from '../types';
import { COLORS } from '../../theme';
import { colors, fonts } from '../../theme/colors';
import {
  COUNTDOWN_MS,
  EXIT_MS,
  FALL_WINDOW_MS,
  RESULT_HOLD_MS,
  ROUNDS,
  RULER_MAX_CM,
  Round,
  RoundKind,
  emergedCm,
  isOnRuler,
  makeWaits,
  normalize,
  roundCm,
  totalCm,
} from './logic';

/**
 * 자를 잡아라 — 화면.
 *
 * 화면 구성
 *   [큰 점수]            지금까지의 점수. 카운트다운 중엔 3·2·1
 *   [슬롯 3개]           라운드 결과가 하나씩 채워진다 ( - / X / 33.4cm )
 *   ━━━━━━━━━━━         상단 막대 — 자가 이 뒤에서 나온다
 *      ┃자┃
 *   ━━━━━━━━━━━         하단 막대 — 여기 닿으면 놓침
 *
 * 나오는 속도는 실제 자유낙하다. d ∝ t² 이고 Easing.in(Easing.quad) 가 t² 곡선이라
 * 끝점만 FALL_WINDOW_MS 시점의 길이로 잡으면 전 구간이 물리와 일치한다.
 * 덕분에 자가 멈춘 눈금이 곧 기록이 된다.
 *
 * 계약 준수:
 *  - Math.random() 없음. 나오는 타이밍은 seed 에서 파생 (logic.makeWaits)
 *  - 네트워크 코드 없음
 *  - 3라운드를 마치면 스스로 종료. 시간이 먼저 끝나면 그때까지의 라운드로 채점
 *  - onFinish 는 정확히 한 번만 호출
 */

const C = {
  wood: '#A9601F', woodEdge: '#7E4413', tick: '#FFF3D0',
};

const BAR_H = 11;
const BAR_BOTTOM_GAP = 26;
const RULER_W = 120;
const TICK_STEP_CM = 5;

type Phase = 'count' | 'armed' | 'emerging' | 'result';

function RulerCatchGame({ seed, timeLimitSec, onFinish }: GameProps) {
  const sound = useGameSound()
  const limitMs = timeLimitSec * 1000;
  const waits = useMemo(() => makeWaits(seed), [seed]);

  const [stageH, setStageH] = useState(0);
  const [stageW, setStageW] = useState(0);
  /** 무대가 화면(Pressable) 안에서 몇 px 아래에 있는지. 터치 좌표를 무대 기준으로 옮길 때 쓴다. */
  const stageTopRef = useRef(0);
  const [phase, setPhase] = useState<Phase>('count');
  const [roundIdx, setRoundIdx] = useState(0);
  const [big, setBig] = useState('0');
  const [sub, setSub] = useState('떨어지는 자를 터치하세요!');
  const [readout, setReadout] = useState<{ text: string; bad: boolean } | null>(null);
  const [done, setDone] = useState<Round[]>([]);

  const roundsRef = useRef<Round[]>([]);
  const roundIdxRef = useRef(0);
  const phaseRef = useRef<Phase>('count');
  const startAtRef = useRef(0);
  const finishedRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pos = useRef(new Animated.Value(0)).current;

  /* ---------- 측정 구간 ---------- */
  const span = Math.max(160, stageH - BAR_BOTTOM_GAP - BAR_H);   // 두 막대 사이
  const rulerH = span + 30;
  const pxPerCm = span / RULER_MAX_CM;
  const rulerY = useCallback(
    (cm: number) => -rulerH + Math.min(span, cm * pxPerCm),
    [rulerH, span, pxPerCm],
  );

  const ticks = useMemo(() => {
    const out: { cm: number; top: number; w: number }[] = [];
    for (let cm = TICK_STEP_CM; cm <= RULER_MAX_CM; cm += TICK_STEP_CM) {
      out.push({
        cm,
        top: rulerH - cm * pxPerCm,
        w: cm % 25 === 0 ? 56 : cm % 10 === 0 ? 38 : 24,
      });
    }
    return out;
  }, [rulerH, pxPerCm]);

  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
    return t;
  }, []);

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  /** 진행 중 표시용 — 끝난 라운드만으로 환산. 3라운드가 끝나면 최종값과 같아진다. */
  const running = useCallback((rs: Round[]) => {
    if (!rs.length) return 0;
    const sum = rs.reduce((s, r) => s + r.cm, 0);
    const target = (TARGET_TOTAL_CM_LOCAL * rs.length) / ROUNDS;
    return Math.min(100, Math.max(0, (target / sum) * 100));
  }, []);

  /* ---------- 종료 ---------- */
  const finish = useCallback((completed: boolean) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    pos.stopAnimation();

    const rounds = roundsRef.current;
    const total = totalCm(rounds);
    onFinish({
      normalizedScore: normalize(rounds),
      score: Math.round(total * 10) / 10,     // 3라운드 합계 cm (화면 표시용)
      tiebreakMs: Math.round(total * 10),     // 합계가 짧을수록 유리 — 동점 판별
      finished: completed,
    });
  }, [onFinish, pos]);

  /* ---------- 라운드 기록 ---------- */
  const record = useCallback((kind: RoundKind, reactionMs: number) => {
    if (finishedRef.current) return;
    const cm = roundCm(kind, reactionMs);
    const r: Round = { kind, cm, ms: kind === 'caught' ? Math.round(reactionMs) : null };
    roundsRef.current = [...roundsRef.current, r];
    setDone(roundsRef.current);
    setPhaseBoth('result');

    pos.stopAnimation();
    // 자를 "멈춘 길이"에 정확히 세운다 — 눈금과 표시된 숫자가 일치한다
    if (kind === 'caught') pos.setValue(rulerY(cm));
    // 놓쳤으면 자는 이미 아래로 빠진 뒤다. 애니메이션이 끝나기 직전에 멈춰서
    // 끄트머리가 걸쳐 있는 일이 없도록 화면 밖으로 확실히 치운다.
    else if (kind === 'miss') pos.setValue(stageH + rulerH);

    setBig(String(Math.round(running(roundsRef.current))));
    if (kind === 'caught') sound.hit();
    else sound.miss();

    if (kind === 'caught') {
      setSub('좋아요!');
      setReadout({ text: `${cm.toFixed(2)}cm`, bad: false });
    } else {
      setSub(kind === 'foul' ? '파울!' : '놓침!');
      setReadout({ text: kind === 'foul' ? '너무 빨랐어요' : '놓쳤어요', bad: true });
    }

    later(() => {
      const next = roundIdxRef.current + 1;
      if (next >= ROUNDS) finish(true);
      else startRound(next);
    }, RESULT_HOLD_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos, rulerY, later, finish, running, setPhaseBoth, stageH, rulerH]);

  /* ---------- 라운드 시작 ---------- */
  const startRound = useCallback((i: number) => {
    if (finishedRef.current || i >= ROUNDS) return;
    roundIdxRef.current = i;
    setRoundIdx(i);
    setReadout(null);
    setSub('떨어지는 자를 터치하세요!');
    setPhaseBoth('count');
    pos.setValue(-rulerH);                    // 완전히 숨긴다

    const steps = Math.round(COUNTDOWN_MS / 1000);
    setBig(String(steps));
    for (let s = 1; s <= steps; s++) {
      later(() => {
        if (finishedRef.current) return;
        const left = steps - s;
        setBig(left > 0 ? String(left) : '!');
      }, s * 1000);
    }

    later(() => {
      if (finishedRef.current || phaseRef.current !== 'count') return;
      setPhaseBoth('armed');                  // 여기서부터 파울 판정
      setBig('');                             // 숫자를 지운다 — 카운트다운만 세고 사라진다
      later(() => {
        if (finishedRef.current || phaseRef.current !== 'armed') return;
        startAtRef.current = Date.now();
        setPhaseBoth('emerging');
        Animated.timing(pos, {
          toValue: rulerY(RULER_MAX_CM),
          duration: FALL_WINDOW_MS,
          easing: Easing.in(Easing.quad),     // t² — 자유낙하와 같은 곡선
          useNativeDriver: true,
        }).start();
        // 눈금을 다 지나면 화면 아래로 빠져나간다. 자가 사라진 뒤에 놓침을 알린다.
        later(() => {
          if (finishedRef.current || phaseRef.current !== 'emerging') return;
          Animated.timing(pos, {
            toValue: stageH + rulerH,         // 자 전체가 무대 밑으로 완전히 빠진다
            duration: EXIT_MS,
            easing: Easing.linear,            // 이미 빠른 속도라 그대로 미끄러진다
            useNativeDriver: true,
          }).start();
          later(() => {
            if (finishedRef.current || phaseRef.current !== 'emerging') return;
            record('miss', FALL_WINDOW_MS);
          }, EXIT_MS);
        }, FALL_WINDOW_MS);
      }, waits[i]);
    }, COUNTDOWN_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waits, pos, rulerH, rulerY, later, record, running, setPhaseBoth, stageH]);

  /* ---------- 터치 ---------- */
  const tap = useCallback((e: GestureResponderEvent) => {
    if (finishedRef.current) return;

    // 자가 나오기도 전에 손이 나가면 파울. 어디를 눌렀는지는 보지 않는다 —
    // 참지 못하고 손이 먼저 나가는 것 자체가 잡아내려는 신호다.
    if (phaseRef.current === 'armed') {
      record('foul', 0);
      return;
    }
    if (phaseRef.current !== 'emerging') return;

    const elapsed = Date.now() - startAtRef.current;

    // 눈금(150cm)을 다 지난 뒤라면 이미 늦었다. 잴 길이가 없으므로 잡히지 않는다.
    if (elapsed > FALL_WINDOW_MS) return;

    // 터치 지점을 무대 기준으로 옮긴다 (Pressable 은 화면 전체라 그만큼 위에서 시작한다)
    const touch = {
      x: e.nativeEvent.locationX,
      y: e.nativeEvent.locationY - stageTopRef.current,
    };

    // 지금까지 나온 길이. 애니메이션이 아니라 경과 시간에서 계산한다.
    const emergedPx = Math.min(span, emergedCm(elapsed) * pxPerCm);

    // 자를 덮지 못했으면 아무 일도 없다. 자는 계속 떨어지고 다시 노려볼 수 있다.
    if (!isOnRuler(touch, stageW, RULER_W, emergedPx)) return;

    record('caught', elapsed);
  }, [record, span, pxPerCm, stageW]);

  /* ---------- 안전망 ----------
     계약 3번(제한시간이 끝나면 스스로 종료)은 무대 높이 측정과 무관하게 지켜져야 한다.
     아래 시작 effect 는 onLayout 이 높이를 알려줄 때까지 기다리는데,
     안전망까지 그 안에 두면 측정이 늦거나 실패했을 때 게임이 영영 안 끝난다.
     호스트가 onFinish 만 기다리므로 그 경우 세션 전체가 멈춘다. */
  useEffect(() => {
    // true인 이유: 제한시간을 다 쓴 것은 정상 종료다. false는 중도 이탈
    // (앱 종료·화면 이탈)만 뜻한다 (games/types.ts GameResult 주석).
    // 여기서 false를 주면 5판을 다 못 채운 사람이 전부 이탈로 기록됐다.
    // 그때까지 잡은 점수는 record가 이미 쌓아뒀으므로 그대로 나간다.
    const guard = setTimeout(() => finish(true), limitMs);
    return () => clearTimeout(guard);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, limitMs]);

  /* ---------- 시작 / 정리 ---------- */
  useEffect(() => {
    if (stageH <= 0) return;                  // 무대 높이를 재고 나서 시작한다
    finishedRef.current = false;
    roundsRef.current = [];
    roundIdxRef.current = 0;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setDone([]);
    setBig('0');

    startRound(0);
    return () => {
      finishedRef.current = true;
      timersRef.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, limitMs, stageH > 0]);

  /* ---------- 렌더 ---------- */
  const slotW = 1 / ROUNDS;

  return (
    <Pressable testID="game-root" style={st.wrap} onPressIn={tap} accessibilityLabel="떨어지는 자를 터치하세요">
      <View style={st.head}>
        <Text style={[st.scoreText, phase === 'count' && st.scoreTextCount]}>{big}</Text>
        <View style={st.subWrap}><Text style={st.subText}>{sub}</Text></View>
      </View>

      <View style={st.slots}>
        {Array.from({ length: ROUNDS }, (_, i) => {
          const r = done[i];
          const active = i === roundIdx && !r;
          return (
            <View key={i} style={[st.slot, (r || active) && st.slotOn]}>
              {r ? (
                r.kind === 'caught'
                  ? <Text style={st.slotText}>{r.cm.toFixed(1)}cm</Text>
                  : <Text style={st.slotX}>X</Text>
              ) : (
                <Text style={st.slotDash}>-</Text>
              )}
            </View>
          );
        })}
        <View style={[st.caret, { left: `${(roundIdx + 0.5) * slotW * 100}%` }]} />
      </View>

      {/* testID: 무대 높이를 받기 전에는 라운드가 시작되지 않는다. 테스트에서
          onLayout을 쏘려면 이 View를 집을 수 있어야 한다 */}
      <View
        testID="stage" style={st.stage}
        onLayout={(e) => {
          const l = e.nativeEvent.layout;
          setStageH(l.height);
          setStageW(l.width);
          stageTopRef.current = l.y;
        }}
      >
        <View style={[st.bar, st.barTop]} />
        {/* 자는 실제로 나올 때부터 그린다.
            숨긴 위치에 미리 두면 기기에 따라 가장자리가 얇게 비쳐서
            카운트다운 중에 "곧 나온다"는 힌트를 준다. */}
        {stageH > 0 && (phase === 'emerging' || phase === 'result') && (
          <Animated.View
            style={[st.ruler, { height: rulerH, transform: [{ translateY: pos }] }]}
            pointerEvents="none"
          >
            {ticks.map((t) => (
              <View key={t.cm} style={[st.tick, { top: t.top, width: t.w }]} />
            ))}
          </Animated.View>
        )}
        {readout && (
          <View style={st.readout} pointerEvents="none">
            <Text style={[st.readoutText, { color: readout.bad ? COLORS.bad : COLORS.brand }]}>
              {readout.text}
            </Text>
          </View>
        )}
        <View style={[st.bar, st.barBot]} />
      </View>
    </Pressable>
  );
}

/** logic.ts 의 TARGET_TOTAL_CM 과 같은 값 (진행 중 표시 계산용) */
const TARGET_TOTAL_CM_LOCAL = 90;

const st = StyleSheet.create({
  /**
   * userSelect: 연타하는 게임이라 웹에서 글자가 드래그 선택된다.
   * react-native-web은 Text를 선택 가능한 요소로 그리기 때문에, 숫자를
   * 빠르게 두드리면 파랗게 잡히고 커서가 텍스트 선택으로 바뀐다.
   * user-select는 CSS 상속이라 루트에만 걸면 자식 Text까지 따라온다.
   * (selectable prop은 RNW에서 deprecated — styles.userSelect를 쓰라고 경고한다)
   */
  wrap: { flex: 1, width: '100%', backgroundColor: COLORS.bg, userSelect: 'none' },

  head: { paddingTop: 40, paddingHorizontal: 20, zIndex: 8 },
  scoreText: { fontFamily: fonts.heading, fontSize: 88, color: colors.primary, textAlign: 'center' },
  scoreTextCount: { fontSize: 104 },
  subWrap: { marginTop: 10 },
  subText: { fontFamily: fonts.bold, fontSize: 19, color: COLORS.brand, textAlign: 'center' },

  slots: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, marginTop: 30, zIndex: 8 },
  slot: {
    flex: 1, height: 62, borderRadius: 31, backgroundColor: COLORS.surfaceAlt,
    borderWidth: 3, borderColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  slotOn: { backgroundColor: COLORS.surface, borderColor: COLORS.brand },
  slotText: { color: COLORS.text, fontWeight: '800', fontSize: 16 },
  slotX: { color: COLORS.bad, fontWeight: '900', fontSize: 22 },
  slotDash: { color: COLORS.text, opacity: 0.45, fontSize: 20, fontWeight: '800' },
  caret: {
    position: 'absolute', top: -11, marginLeft: -9,
    width: 0, height: 0,
    borderLeftWidth: 9, borderRightWidth: 9, borderTopWidth: 11,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: COLORS.text,
  },

  stage: { flex: 1, marginTop: 8, overflow: 'hidden', zIndex: 1 },
  bar: {
    position: 'absolute', alignSelf: 'center', width: '82%',
    height: BAR_H, borderRadius: 99, backgroundColor: COLORS.text, zIndex: 4,
  },
  barTop: { top: 0 },
  barBot: { bottom: BAR_BOTTOM_GAP },

  ruler: {
    position: 'absolute', top: 0, alignSelf: 'center', width: RULER_W,
    backgroundColor: C.wood, zIndex: 3,
    borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
    borderLeftWidth: 26, borderLeftColor: C.woodEdge,
  },
  tick: { position: 'absolute', left: 0, height: 3, borderRadius: 2, backgroundColor: C.tick },

  readout: { position: 'absolute', left: 0, right: 0, bottom: 48, zIndex: 5 },
  readoutText: { fontFamily: fonts.bold, fontSize: 24, textAlign: 'center' },
});

export const rulercatch: GameModule = {
  info: {
    id: 'rulercatch',
    name: '자를 잡아라',
    emoji: '📏',
    desc: '튀어나오는 자를 최대한 빨리 멈추기 · 3라운드 합산',
    timeLimitSec: 20,   // 팀 규칙: 모든 게임 20초
  },
  Component: RulerCatchGame,
};
