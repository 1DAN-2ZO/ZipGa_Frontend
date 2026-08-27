import { getActiveSession } from '../sessions'

/**
 * 버려진 세션이 방을 잠가버리던 문제.
 *
 * sessions.ended_at을 채우는 곳은 end_session RPC 하나뿐인데, 그건 3판을
 * 끝까지 돈 클라이언트만 부른다. 도중에 전원이 탭을 닫거나 새로고침하면
 * 아무도 안 부르고 그 행은 영영 열린 채로 남는다.
 *
 * 그러면 그 방에 들어오는 사람은 전부 "지금 게임이 진행 중이에요" 대기
 * 화면으로 밀리고, 방장도 start_session에서 SESSION_IN_PROGRESS로 막힌다.
 * 방이 만료될 때까지(2시간) 아무도 못 논다.
 */

const ROOM = 'room-1'

/** supabase 쿼리 빌더를 흉내낸다 — 체이닝 끝에서 rows를 돌려준다. */
function mockSupabase(rows: Array<{ id: string; starts_at: string }>) {
  const builder: Record<string, unknown> = {}
  for (const m of ['select', 'eq', 'is', 'order']) {
    builder[m] = jest.fn(() => builder)
  }
  builder.limit = jest.fn(() => Promise.resolve({ data: rows, error: null }))
  return { from: jest.fn(() => builder) }
}

jest.mock('../../lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { supabase } = require('../../lib/supabase')

const minutesAgo = (n: number) => new Date(Date.now() - n * 60 * 1000).toISOString()

describe('getActiveSessionId', () => {
  it('방금 시작한 세션은 진행 중으로 본다', async () => {
    const mock = mockSupabase([{ id: 'live', starts_at: minutesAgo(1) }])
    supabase.from = mock.from

    await expect(getActiveSession(ROOM)).resolves.toMatchObject({ id: 'live' })
  })

  it('한 세션이 최대로 길어도 2분이면 끝나므로 5분은 아직 살아 있다고 본다', async () => {
    // 공개 3.9초 + 출발 여유 5초 + 3라운드 x 28초 = 약 93초.
    // 임계값(10분)까지는 여유를 크게 둬서 정상 세션을 죽이지 않는다.
    const mock = mockSupabase([{ id: 'live', starts_at: minutesAgo(5) }])
    supabase.from = mock.from

    await expect(getActiveSession(ROOM)).resolves.toMatchObject({ id: 'live' })
  })

  it('버려진 지 오래된 세션은 없는 것으로 친다', async () => {
    const mock = mockSupabase([{ id: 'zombie', starts_at: minutesAgo(30) }])
    supabase.from = mock.from

    // null이어야 새로 들어온 사람이 로비로 갈 수 있다
    await expect(getActiveSession(ROOM)).resolves.toBeNull()
  })

  it('진행 중인 세션이 없으면 null이다', async () => {
    const mock = mockSupabase([])
    supabase.from = mock.from

    await expect(getActiveSession(ROOM)).resolves.toBeNull()
  })

  it('starts_at을 읽을 수 없으면 살아 있는 쪽으로 판단한다', async () => {
    // 판단이 안 설 때 세션을 죽이면 진행 중인 게임을 깨뜨릴 수 있다.
    const mock = mockSupabase([{ id: 'unknown', starts_at: 'not-a-date' }])
    supabase.from = mock.from

    await expect(getActiveSession(ROOM)).resolves.toMatchObject({ id: 'unknown' })
  })
})
