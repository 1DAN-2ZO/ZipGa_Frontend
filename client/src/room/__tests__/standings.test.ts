jest.mock('../../lib/supabase', () => ({ supabase: { from: jest.fn() } }))

import { computeStandings, type ScoreRow, type SessionRow } from '../standings'

function scoresFor(sessionId: string, entries: Record<string, number[]>): ScoreRow[] {
  const rows: ScoreRow[] = []
  for (const [playerId, normalized] of Object.entries(entries)) {
    for (const value of normalized) rows.push({ player_id: playerId, session_id: sessionId, normalized: value })
  }
  return rows
}

describe('computeStandings', () => {
  it('진행 중인(끝나지 않은) 세션은 무시한다', () => {
    const sessions: SessionRow[] = [{ id: 's1', ended_at: null }]
    const scores = scoresFor('s1', { p1: [90, 90, 90] })

    expect(computeStandings(sessions, scores).size).toBe(0)
  })

  it('avgScore는 누적이 아니라 방금 끝난 세션 하나만 본다', () => {
    const sessions: SessionRow[] = [
      { id: 's1', ended_at: '2026-08-27T10:00:00Z' },
      { id: 's2', ended_at: '2026-08-27T11:00:00Z' },
    ]
    const scores = [
      ...scoresFor('s1', { p1: [90, 90, 90] }), // s1 평균 90
      ...scoresFor('s2', { p1: [30, 30, 30] }), // s2 평균 30
    ]

    const standings = computeStandings(sessions, scores)
    expect(standings.get('p1')?.avgScore).toBe(30)
  })

  it('previousRank는 직전 세션 하나만 따로 채점한 순위다', () => {
    const sessions: SessionRow[] = [
      { id: 's1', ended_at: '2026-08-27T10:00:00Z' },
      { id: 's2', ended_at: '2026-08-27T11:00:00Z' },
    ]
    const scores = [
      // s1: p2가 1등, p1이 2등
      ...scoresFor('s1', { p1: [10, 10, 10], p2: [90, 90, 90] }),
      // s2: p1이 역전해서 1등
      ...scoresFor('s2', { p1: [80, 80, 80], p2: [20, 20, 20] }),
    ]

    const standings = computeStandings(sessions, scores)
    expect(standings.get('p1')).toEqual({ avgScore: 80, previousRank: 2 })
    expect(standings.get('p2')).toEqual({ avgScore: 20, previousRank: 1 })
  })

  it('첫 세션(직전 세션이 없음)이면 previousRank가 없다', () => {
    const sessions: SessionRow[] = [{ id: 's1', ended_at: '2026-08-27T10:00:00Z' }]
    const scores = scoresFor('s1', { p1: [90, 90, 90] })

    expect(computeStandings(sessions, scores).get('p1')).toEqual({ avgScore: 90, previousRank: undefined })
  })

  it('직전 세션에 없던 사람은 previousRank가 없다', () => {
    const sessions: SessionRow[] = [
      { id: 's1', ended_at: '2026-08-27T10:00:00Z' },
      { id: 's2', ended_at: '2026-08-27T11:00:00Z' },
    ]
    const scores = [
      ...scoresFor('s1', { p1: [90, 90, 90] }), // p2는 s1에 없었다
      ...scoresFor('s2', { p1: [60, 60, 60], p2: [70, 70, 70] }),
    ]

    const standings = computeStandings(sessions, scores)
    expect(standings.get('p2')).toEqual({ avgScore: 70, previousRank: undefined })
  })

  it('방금 세션에 참가하지 않은 사람은 목록에 없다', () => {
    const sessions: SessionRow[] = [
      { id: 's1', ended_at: '2026-08-27T10:00:00Z' },
      { id: 's2', ended_at: '2026-08-27T11:00:00Z' },
    ]
    const scores = [
      ...scoresFor('s1', { p1: [90, 90, 90] }),
      ...scoresFor('s2', { p2: [70, 70, 70] }), // p1은 s2를 쉬었다
    ]

    expect(computeStandings(sessions, scores).has('p1')).toBe(false)
  })
})
