import { COLORS } from '../theme'

/**
 * 앱 화면(로비·방·결과 등)이 쓰는 색.
 *
 * 미니게임은 `theme.ts`의 COLORS를 쓴다. 한 세션에서 화면과 게임이
 * 번갈아 나오므로(로비 → 게임 공개 → 카운트다운 → 게임 → 판 결과)
 * 같은 역할의 색은 반드시 같은 값이어야 한다. 예전에는 배경이
 * #E9E9EE와 #E9E9ED로 갈라져 있었다 — 정의가 두 벌이면 이렇게 어긋난다.
 *
 * 그래서 겹치는 역할은 여기서 값을 새로 쓰지 않고 COLORS를 그대로 가져온다.
 * 아래에서 리터럴로 남은 것은 앱 화면에만 있는 역할뿐이다.
 */
export const colors = {
  /** 모든 화면의 바탕 — 게임과 같은 값이어야 한다 */
  background: COLORS.bg,
  /** 바탕 위에 얹는 판·카드 */
  white: COLORS.surface,
  /** 본문 글씨 */
  textPrimary: COLORS.text,
  /** 라벨처럼 한 단계 죽인 글씨 */
  textMuted: COLORS.textMuted,
  /** 잘한 것 · 통과 */
  good: COLORS.good,
  /** 틀린 것 · 벌칙 */
  danger: COLORS.bad,

  // --- 앱 화면에만 있는 역할 ---
  /** 브랜드 보라. 버튼·강조 */
  primary: COLORS.brand,
  /** primary를 아주 연하게 깐 면. QR 상자 바탕 */
  primarySoft: '#F1E9FE',
  secondary: '#FFFF9E',
  /** textPrimary와 textMuted 사이 */
  textSecondary: '#46464D',
  /** 입력칸 바탕 */
  inputBg: '#F2F2F2',
  /** 줄 구분선. COLORS.border보다 옅다 — 화면에서는 선이 배경에 가까워야 한다 */
  divider: '#E0E0E0',
  /** 지금 접속 중이라는 점. 작아서 COLORS.good보다 밝게 간다 */
  online: '#3ED598',
} as const

export const radius = {
  pill: 9999,
} as const

export const fonts = {
  heading: 'Quicksand_700Bold',
  bold: 'Quicksand_700Bold',
  semibold: 'Quicksand_600SemiBold',
  regular: 'Quicksand_500Medium',
} as const
