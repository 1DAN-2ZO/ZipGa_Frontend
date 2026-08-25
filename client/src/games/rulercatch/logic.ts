import { createRng } from '../prng';

/**
 * 자를 잡아라 — 순수 로직.
 *
 * 3초 카운트다운 뒤 랜덤한 순간에 자가 상단바 뒤에서 튀어나온다.
 * 화면을 터치하면 그 자리에서 멈추고, **나온 길이(cm)** 가 그 라운드의 기록이 된다.
 * 짧을수록 좋다. 3라운드 합계로 채점한다.
 *
 * 나오는 속도는 실제 자유낙하다 — d = ½gt².
 * 그래서 화면에서 읽히는 눈금이 곧 아래에 표시되는 cm 값이다.
 *
 * ── 계약(P2 게임계약)과 부딪히는 지점 · 팀 확인 필요 ────────────────
 * 가이드의 "밀리초 단위 실시간 판정이 필요한 게임은 만들지 않는다" 조항과 충돌한다.
 * 폰마다 터치 지연·주사율이 30~50ms 다른데 사람 반응이 250~350ms 라 순위가 뒤집힐 수 있다.
 * 세 가지로 완화했다.
 *   1. 반응 시간을 애니메이션 위치가 아니라 타임스탬프 차이로 잰다
 *   2. 3라운드 합계로 채점한다 — 한 번의 튐이 순위를 못 바꾼다
 *   3. 목표 합계 대비 비율이라 20~30ms 차이가 점수 몇 점 수준에 머문다
 * ──────────────────────────────────────────────────────────────
 *
 * 취기 감지: 반응이 느려지는 것보다 **파울(나오기도 전에 손이 나가는 것)** 이
 * 훨씬 선명한 신호다. 취하면 못 참는다. 파울은 실격이 아니라 아주 긴 길이로 환산한다.
 */

/** 한 판의 라운드 수. 합계로 채점한다. */
export const ROUNDS = 3;

/** 라운드 시작 카운트다운(ms) */
export const COUNTDOWN_MS = 3000;

/** 카운트다운이 끝난 뒤 실제로 나오기까지의 대기 범위(ms). 예측을 막는다. */
export const WAIT_MIN_MS = 300;
export const WAIT_MAX_MS = 1200;

/** 결과 확인 시간(ms) */
export const RESULT_HOLD_MS = 900;

/** 중력가속도 (m/s^2) */
export const GRAVITY = 9.8;

/** 자에 그려지는 눈금의 최대값(cm). 무대 높이 전체가 이 길이에 해당한다. */
export const RULER_MAX_CM = 150;

/**
 * 자가 끝까지 나오는 데 걸리는 시간(ms). 이 안에 못 멈추면 놓친 것.
 * RULER_MAX_CM 을 자유낙하로 역산한 값이라 별도 튜닝값이 아니다.
 */
export const FALL_WINDOW_MS = Math.round(
  Math.sqrt(RULER_MAX_CM / (0.5 * GRAVITY * 100)) * 1000,
);

/**
 * 3라운드 합계가 이 값이면 100점.
 * ★ 실측 후 보정 대상 — 이 값 하나가 이 게임의 난이도 전부다.
 * (기준: 잘한 반응 240ms ≈ 28cm, 3라운드 ≈ 85cm)
 */
export const TARGET_TOTAL_CM = 90;

/** 파울 라운드에 매기는 길이(cm). 0점 처리 대신 무거운 감점. */
export const FOUL_CM = 165;

/** 놓친 라운드에 매기는 길이(cm). */
export const MISS_CM = 185;

export type RoundKind = 'caught' | 'foul' | 'miss';

export interface Round {
  kind: RoundKind;
  /** 채점에 쓰이는 길이(cm). 파울·놓침은 환산값이 들어간다. */
  cm: number;
  /** 멈췄을 때의 반응시간(ms). 화면 표시용. */
  ms: number | null;
}

/**
 * 시드에서 라운드별 대기 시간을 만든다.
 *
 * 모든 플레이어가 같은 순서로 같은 타이밍에 자를 받는다.
 * 이게 다르면 "쟤는 빨리 나왔잖아" 소리가 나온다.
 */
export function makeWaits(seed: number): number[] {
  const rng = createRng(seed);
  const waits: number[] = [];
  for (let i = 0; i < ROUNDS; i++) {
    waits.push(rng.int(WAIT_MIN_MS, WAIT_MAX_MS));
  }
  return waits;
}

/**
 * 자가 나온 지 t(ms) 지났을 때 나온 길이(cm).
 *
 * 자유낙하 d = ½gt². 실제 "자 떨어뜨리기" 반응 검사와 같은 식이다.
 */
export function emergedCm(elapsedMs: number): number {
  const t = Math.max(0, elapsedMs) / 1000;
  return 0.5 * GRAVITY * t * t * 100;
}

/** 라운드 결과를 채점용 길이로 환산한다. */
export function roundCm(kind: RoundKind, reactionMs: number): number {
  if (kind === 'foul') return FOUL_CM;
  if (kind === 'miss') return MISS_CM;
  return Math.max(0.1, Math.min(RULER_MAX_CM, emergedCm(reactionMs)));
}

/**
 * 3라운드 합계(cm).
 *
 * 시간이 모자라 못 한 라운드는 "놓침"으로 채운다.
 * 안 그러면 라운드를 적게 할수록 합계가 작아져서 유리해진다.
 */
export function totalCm(rounds: readonly Round[]): number {
  let sum = 0;
  for (let i = 0; i < ROUNDS; i++) {
    sum += i < rounds.length ? rounds[i].cm : MISS_CM;
  }
  return sum;
}

/**
 * 0~100 정규화. 길이형(짧을수록 좋음)이므로 뒤집어서 반환한다.
 *
 * 목표 합계 / 실제 합계 × 100
 *
 * - 3라운드 모두 240ms(28cm) → 100점
 * - 3라운드 모두 300ms(44cm) → 68점
 * - 3라운드 모두 350ms(60cm) → 50점
 * - 파울만 셋 → 18점 (벌칙 기준선 40 아래)
 */
export function normalize(rounds: readonly Round[]): number {
  const total = totalCm(rounds);
  if (!Number.isFinite(total) || total <= 0) return 0;
  return Math.min(100, Math.max(0, (TARGET_TOTAL_CM / total) * 100));
}

/** 화면에 보여줄 평균 반응시간(ms). 멈춘 라운드만 센다. */
export function averageCaughtMs(rounds: readonly Round[]): number | null {
  const caught = rounds.filter((r) => r.kind === 'caught' && r.ms !== null);
  if (caught.length === 0) return null;
  return Math.round(caught.reduce((s, r) => s + (r.ms as number), 0) / caught.length);
}
