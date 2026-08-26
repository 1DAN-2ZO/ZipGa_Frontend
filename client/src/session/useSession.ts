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
  /** 지금 세션의 id. 판별 점수 조회(scores 테이블 질의) 등에 쓴다 */
  sessionId: string | null
  verdict: SessionVerdict[] | null
  /** 보정된 서버 시각 기준의 시작 시각(ms) */
  startsAtMs: number | null
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
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [verdict, setVerdict] = useState<SessionVerdict[] | null>(null)
  const [startsAtMs, setStartsAtMs] = useState<number | null>(null)
  const [error, setError] = useState<SessionErrorCode | null>(null)

  const sessionIdRef = useRef<string | null>(null)
  const submittedRef = useRef<Set<number>>(new Set())
  const endedRef = useRef(false)

  const begin = useCallback(
    (row: SessionRow) => {
      sessionIdRef.current = row.session_id
      submittedRef.current = new Set()
      endedRef.current = false
      setSessionId(row.session_id)
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

  return { state, sessionId, verdict, startsAtMs, error, start, advance }
}
