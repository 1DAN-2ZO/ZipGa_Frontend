import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import type { GameModule } from '../games/types'
import type { RpcClient, SessionErrorCode, SessionVerdict } from './api'
import { endSession, SessionError, startSession, submitScore } from './api'
import type { Clock } from './clock'
import { planSession } from './lineup'
import type { SessionEvent, SessionState } from './machine'
import { initSession, sessionReducer } from './machine'

/** 서버 sessions 테이블의 한 행. Realtime으로 들어온다. */
export interface SessionRow {
  session_id: string
  seed: number
  starts_at: string
}

/**
 * ⚠️ 이 객체는 호출부에서 반드시 메모할 것.
 *
 * 인라인으로 만들면 매 렌더마다 새 객체가 되어 Realtime 구독이
 * 계속 끊겼다 붙는다. useMemo로 감싸거나 모듈 스코프에 둔다.
 */
export interface UseSessionDeps {
  client: RpcClient
  clock: Clock
  /** sessions INSERT 구독. 정리 함수를 돌려준다. */
  subscribeSessionStart: (cb: (row: SessionRow) => void) => () => void
  /** 테스트에서 게임 풀을 주입하기 위한 통로 */
  pool?: readonly GameModule[]
}

export interface SessionHandle {
  state: SessionState | null
  /** 진행 중인 세션 id. 판 결과를 구독할 때 쓴다 */
  sessionId: string | null
  verdict: SessionVerdict[] | null
  /**
   * 시작 시각(ms). 서버가 준 절대 시각이므로 `Date.now()`가 아니라
   * 아래 `nowMs()`와 견줘야 카운트다운이 맞는다.
   */
  startsAtMs: number | null
  /**
   * 보정된 현재 시각(ms).
   *
   * 폰 시계는 서버와 몇 초씩 어긋나 있는 게 정상이라, 남은 시간을
   * `startsAtMs - Date.now()`로 재면 사람마다 출발선이 달라진다
   * (백엔드_Supabase명세.md §5.9).
   */
  nowMs: () => number
  error: SessionErrorCode | null
  /** 방장만 부른다 */
  start: () => Promise<void>
  advance: (event: SessionEvent) => void
}

type InternalEvent = SessionEvent | { type: 'BEGIN'; state: SessionState }

function reducer(state: SessionState | null, event: InternalEvent): SessionState | null {
  if (event.type === 'BEGIN') return event.state
  return state === null ? null : sessionReducer(state, event)
}

export function useSession(deps: UseSessionDeps): SessionHandle {
  const [state, dispatch] = useReducer(reducer, null)
  const [verdict, setVerdict] = useState<SessionVerdict[] | null>(null)
  const [startsAtMs, setStartsAtMs] = useState<number | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [error, setError] = useState<SessionErrorCode | null>(null)

  const sessionIdRef = useRef<string | null>(null)
  const submittedRef = useRef<Set<number>>(new Set())
  const endedRef = useRef(false)

  const begin = useCallback(
    (row: SessionRow) => {
      sessionIdRef.current = row.session_id
      setSessionId(row.session_id)
      submittedRef.current = new Set()
      endedRef.current = false
      setVerdict(null)
      setError(null)
      setStartsAtMs(Date.parse(row.starts_at))
      dispatch({ type: 'BEGIN', state: initSession(planSession(row.seed, deps.pool)) })
    },
    [deps.pool],
  )

  // 참가자는 Realtime 알림만으로 세션에 합류한다.
  useEffect(() => deps.subscribeSessionStart(begin), [deps, begin])

  const start = useCallback(async () => {
    try {
      const started = await startSession(deps.client)
      begin({
        session_id: started.sessionId,
        seed: started.seed,
        starts_at: started.startsAt,
      })
    } catch (e) {
      setError(e instanceof SessionError ? e.code : 'UNKNOWN')
    }
  }, [deps.client, begin])

  const advance = useCallback((event: SessionEvent) => dispatch(event), [])

  // 접속 시 한 번 서버와 시계를 맞춘다.
  // 참가자는 start_session 응답을 못 받으므로 각자 독립적으로 구해야 한다.
  // 실패해도 보정값 0으로 그냥 진행한다 — 카운트다운이 조금 어긋날 뿐,
  // 세션을 막을 만한 일은 아니다.
  useEffect(() => {
    deps.clock.sync().catch(() => {})
  }, [deps.clock])

  const nowMs = useCallback(() => deps.clock.now(), [deps.clock])

  // 판이 끝날 때마다 그 판 점수를 올린다. 같은 판을 두 번 올리지 않는다.
  useEffect(() => {
    const sessionId = sessionIdRef.current
    if (!state || !sessionId || state.phase !== 'roundResult') return

    const roundIndex = state.roundIndex
    if (submittedRef.current.has(roundIndex)) return
    submittedRef.current.add(roundIndex)

    const result = state.results[roundIndex]
    submitScore(deps.client, { sessionId, roundIndex, result }).catch((e) => {
      setError(e instanceof SessionError ? e.code : 'UNKNOWN')
    })
  }, [state, deps.client])

  // 3판이 끝나면 판정을 요청한다. 한 번만 부른다.
  useEffect(() => {
    const sessionId = sessionIdRef.current
    if (!state || !sessionId || state.phase !== 'final' || endedRef.current) return
    endedRef.current = true

    endSession(deps.client, sessionId)
      .then(setVerdict)
      .catch((e) => setError(e instanceof SessionError ? e.code : 'UNKNOWN'))
  }, [state, deps.client])

  return { state, sessionId, verdict, startsAtMs, nowMs, error, start, advance }
}
