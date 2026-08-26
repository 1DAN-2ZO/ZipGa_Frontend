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

export interface UseSessionDeps {
  client: RpcClient
  clock: Clock
  subscribeSessionStart: (cb: (row: SessionRow) => void) => () => void
  /** 지금 세션에 실제로 참여 중인 플레이어 id 목록. 종합 판정을 부르기 전에
   * 이 사람들이 3판을 다 냈는지 기다리는 데 쓴다. */
  getSessionParticipantIds: () => readonly string[]
  /** 참가자 전원이 3판을 다 낼 때까지(또는 타임아웃까지) 기다린다. Realtime 배선은
   * 앱 골격의 Supabase 계층(room/scores.ts)이 맡고, 여기는 함수만 주입받는다 —
   * 세션 엔진에는 화면 코드도, Supabase 직접 의존도 없어야 한다. */
  waitForAllScores: (sessionId: string, participantIds: readonly string[]) => Promise<void>
  pool?: readonly GameModule[]
}

export interface SessionHandle {
  state: SessionState | null
  sessionId: string | null
  verdict: SessionVerdict[] | null
  startsAtMs: number | null
  error: SessionErrorCode | null
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
  //
  // 요청 자체는 즉시 안 부르고, 이 세션 참가자 전원이 3판을 다 낼 때까지
  // 최대 60초 기다린 뒤 부른다 — 누가 조금 늦게 진행되고 있어도 3판째 제출이
  // end_session에 막 걸려 SESSION_NOT_ACTIVE로 거부당하는 일을 줄인다.
  // (벌칙 판정 자체는 안 바뀐다 — 여전히 "3판 평균 < 40" 하나뿐이다.)
  useEffect(() => {
    const sessionId = sessionIdRef.current
    if (!state || !sessionId || state.phase !== 'final' || endedRef.current) return
    endedRef.current = true

    let cancelled = false
    ;(async () => {
      await deps.waitForAllScores(sessionId, deps.getSessionParticipantIds())
      if (cancelled) return
      try {
        const result = await endSession(deps.client, sessionId)
        if (!cancelled) setVerdict(result)
      } catch (e) {
        if (!cancelled) setError(e instanceof SessionError ? e.code : 'UNKNOWN')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [state, deps])

  return { state, sessionId, verdict, startsAtMs, error, start, advance }
}
