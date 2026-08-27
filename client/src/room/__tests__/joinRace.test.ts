/**
 * "다같이 방에 들어가서 시작했는데 참가자만 '게임 진행 중'이라며 튕기는" 문제.
 *
 * 같은 sessions INSERT를 두 구독이 서로 다른 채널로 듣는다.
 *   room-sessions:{roomId}        → 합류 신호 (session.state 를 채운다)
 *   room-active-session:{roomId}  → 방에 세션이 있다는 신호
 *
 * 채널이 다르면 도착 순서가 보장되지 않는다. 뒤쪽이 먼저 오면 "세션은 있는데
 * 나는 아직 합류를 못 했다"는 상태가 잠깐 생기는데, 그걸 늦게 들어온 사람으로
 * 오해하면 같이 시작한 사람이 대기 화면에 갇힌다 — 세션이 끝나야 빠져나오므로
 * 그 판을 통째로 날린다.
 *
 * App.tsx는 시작 시각 기준 유예(JOIN_SIGNAL_GRACE_MS)를 두고 판단한다.
 * 여기서는 그 판단식만 떼어 검증한다.
 */

// sessions.ts는 supabase 클라이언트를 끌고 오는데(AsyncStorage 네이티브 모듈),
// 여기서 검사하는 건 시각 계산뿐이라 DB는 필요 없다.
jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn(), channel: jest.fn() } }))

import { JOIN_SIGNAL_GRACE_MS, waitBeforeBounce } from '../sessions'

/** 서버가 starts_at을 now()+5초로 잡는다 (백엔드 c_lead_sec). */
const SERVER_LEAD_MS = 5000

const NOW = Date.parse('2026-08-27T12:00:00.000Z')
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()

describe('세션 시작 직후 참가자 판정', () => {
  it('방금 시작한 세션이면 바로 튕기지 않고 합류 신호를 기다린다', () => {
    // 방장이 누른 직후. starts_at은 아직 미래다.
    const startsAt = at(SERVER_LEAD_MS)

    expect(waitBeforeBounce(startsAt, NOW)).toBeGreaterThan(0)
  })

  it('출발 시각이 지난 직후에도 아직 기다린다', () => {
    // 3·2·1이 끝나 게임이 막 시작된 시점. 이때 합류 신호가 늦게 와도 튕기면 안 된다.
    const startsAt = at(0)

    expect(waitBeforeBounce(startsAt, NOW + 1000)).toBeGreaterThan(0)
  })

  it('유예가 지나도록 합류가 없으면 그때는 늦게 들어온 사람이다', () => {
    const startsAt = at(0)

    expect(waitBeforeBounce(startsAt, NOW + JOIN_SIGNAL_GRACE_MS + 1)).toBe(0)
  })

  it('한참 전에 시작한 세션이면 즉시 대기 화면으로 보낸다', () => {
    // 세션 도중에 새로 들어온 사람. 게임 3개와 시드가 이미 배포돼 낄 수 없다.
    const startsAt = at(-60 * 1000)

    expect(waitBeforeBounce(startsAt, NOW)).toBe(0)
  })

  it('시작 시각을 읽을 수 없으면 기다리지 않는다', () => {
    // 판단 근거가 없으면 기존 동작(즉시 대기)을 따른다.
    expect(waitBeforeBounce('not-a-date', NOW)).toBe(0)
  })

  it('INSERT 시점부터 약 10초를 벌어준다', () => {
    // 서버 여유 5초 + 유예 5초. 술집 LTE에서 Realtime이 한 박자 늦어도 버틴다.
    const startsAt = at(SERVER_LEAD_MS)

    expect(waitBeforeBounce(startsAt, NOW)).toBe(SERVER_LEAD_MS + JOIN_SIGNAL_GRACE_MS)
  })
})
