import type { GameResult } from '../games/types'

/** 백엔드가 raise exception으로 던지는 코드들. */
export const SESSION_ERROR_CODES = [
  'AUTH_REQUIRED',
  'ROOM_NOT_FOUND',
  'ROOM_EXPIRED',
  'PLAYER_NOT_FOUND',
  'NOT_IN_ROOM',
  'NOT_HOST',
  'SESSION_IN_PROGRESS',
  'SESSION_NOT_ACTIVE',
  'NOT_ENOUGH_PLAYERS',
  'BAD_PERIOD',
] as const

export type SessionErrorCode = (typeof SESSION_ERROR_CODES)[number] | 'UNKNOWN'

export class SessionError extends Error {
  readonly code: SessionErrorCode

  constructor(code: SessionErrorCode, message: string) {
    super(message)
    this.name = 'SessionError'
    this.code = code
  }
}

/**
 * Supabase 클라이언트에서 우리가 쓰는 부분만 좁게 잡은 인터페이스.
 * 테스트에서 가짜를 만들기 쉽게 하기 위함이다.
 */
export interface RpcClient {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>
}

export interface SubmitScoreArgs {
  sessionId: string
  roundIndex: number
  result: GameResult
}

export interface SessionVerdict {
  playerId: string
  nickname: string
  avgScore: number
  penalized: boolean
}

/** Postgres가 접두사를 붙여 보내도 알려진 코드를 찾아낸다. */
function toSessionError(message: string): SessionError {
  const found = SESSION_ERROR_CODES.find((code) => message.includes(code))
  return new SessionError(found ?? 'UNKNOWN', message)
}

async function call(
  client: RpcClient,
  fn: string,
  args?: Record<string, unknown>,
): Promise<unknown> {
  const { data, error } = await client.rpc(fn, args)
  if (error) throw toSessionError(error.message)
  return data
}

export async function serverNowMs(client: RpcClient): Promise<number> {
  const data = await call(client, 'server_now')
  return Date.parse(String(data))
}

export async function startSession(
  client: RpcClient,
): Promise<{ sessionId: string; seed: number; startsAt: string }> {
  const rows = (await call(client, 'start_session')) as Array<{
    session_id: string
    seed: number
    starts_at: string
  }>
  const row = rows[0]
  return { sessionId: row.session_id, seed: row.seed, startsAt: row.starts_at }
}

/**
 * 재시도 사이 대기 시간(ms). 마지막 것까지 다 실패하면 포기한다.
 *
 * 판 제출이 한 번이라도 실패한 채 그냥 넘어가면, waitForAllScores(room/scores.ts)는
 * 그 사람을 영원히 "아직 제출 안 함"으로 본다 — 다시 낼 방법이 없으니 realtime으로도
 * 못 잡고, END_SESSION_WAIT_MS를 매번 끝까지 태운다(30초든 60초든 숫자를 바꿔도
 * 안 고쳐지는 이유였다). submit_score는 (session_id, player_id, round_index) unique
 * conflict do nothing이라 몇 번을 다시 불러도 안전하다.
 */
const SUBMIT_RETRY_DELAYS_MS = [500, 1500, 3000]

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function submitScore(
  client: RpcClient,
  { sessionId, roundIndex, result }: SubmitScoreArgs,
): Promise<void> {
  const args = {
    p_session_id: sessionId,
    p_round_index: roundIndex,
    p_normalized: result.normalizedScore,
    p_raw_score: result.score,
    p_tiebreak_ms: result.tiebreakMs,
    p_finished: result.finished,
  }

  for (let attempt = 0; ; attempt++) {
    try {
      await call(client, 'submit_score', args)
      return
    } catch (e) {
      // SESSION_NOT_ACTIVE·NOT_IN_ROOM 같은 건 다시 불러도 똑같이 실패한다 —
      // 재시도로 나아지는 건 원인을 모르는(UNKNOWN) 실패뿐이다(네트워크 끊김 등).
      const permanent = e instanceof SessionError && e.code !== 'UNKNOWN'
      if (permanent || attempt >= SUBMIT_RETRY_DELAYS_MS.length) throw e
      await sleep(SUBMIT_RETRY_DELAYS_MS[attempt])
    }
  }
}

export async function endSession(
  client: RpcClient,
  sessionId: string,
): Promise<SessionVerdict[]> {
  const rows = (await call(client, 'end_session', {
    p_session_id: sessionId,
  })) as Array<{
    player_id: string
    nickname: string
    avg_score: number
    penalized: boolean
  }>

  return rows.map((r) => ({
    playerId: r.player_id,
    nickname: r.nickname,
    avgScore: r.avg_score,
    penalized: r.penalized,
  }))
}
