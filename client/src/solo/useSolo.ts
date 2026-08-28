import { useCallback, useReducer, useRef, useState } from 'react'
import type { GameModule } from '../games/types'
import { planSession } from '../session/lineup'
import type { SessionEvent, SessionState } from '../session/machine'
import { initSession, sessionReducer } from '../session/machine'
import { BRIEFING_MS } from '../session/useSession'

/**
 * 혼자 하기 세션.
 *
 * useSession과 판 진행 규칙(session/machine.ts)·편성 규칙(session/lineup.ts)을
 * 그대로 공유하되, 서버가 하던 세 가지 — 시드 발급, 점수 제출, 종합 판정 — 만
 * 없앤 것이다. 그래서 방·로그인·Realtime 없이도 같은 3판이 돌아간다.
 *
 * 시드를 폰이 직접 뽑는 게 유일한 차이다. 맞춰볼 상대가 없으니 전원이 같은
 * 결과를 얻어야 한다는 제약 자체가 사라진다.
 */
export interface UseSoloDeps {
  /** 지금(ms). 혼자라 서버 보정이 필요 없어서 기본은 폰 시계다. */
  now?: () => number
  /** 세션 시드. 테스트에서 고정한다. */
  drawSeed?: () => number
  pool?: readonly GameModule[]
}

export interface SoloHandle {
  /** 아직 시작 전이면 null. 시작하기를 누르는 순간 lineup으로 채워진다. */
  state: SessionState | null
  /** 이 판 카운트다운이 끝나는 시각(ms). */
  startsAtMs: number | null
  /** 이번 세션의 시드. 결과 화면이 그대로 보여준다. */
  seed: number | null
  start: () => void
  advance: (event: SessionEvent) => void
  /** 로비로 되돌린다. 다시하기·나가기가 같이 쓴다. */
  reset: () => void
}

type InternalEvent = SessionEvent | { type: 'BEGIN'; state: SessionState } | { type: 'RESET' }

function reducer(state: SessionState | null, event: InternalEvent): SessionState | null {
  if (event.type === 'BEGIN') return event.state
  if (event.type === 'RESET') return null
  return state === null ? null : sessionReducer(state, event)
}

/** 시드를 6자리로 뽑는다. 결과 화면에 불러주기 좋은 자릿수다(GameSandbox와 같은 규칙). */
const defaultDrawSeed = () => 100000 + Math.floor(Math.random() * 900000)

export function useSolo(deps: UseSoloDeps = {}): SoloHandle {
  const [state, dispatch] = useReducer(reducer, null)
  const [startsAtMs, setStartsAtMs] = useState<number | null>(null)
  const [seed, setSeed] = useState<number | null>(null)

  // advance를 안정적으로 유지하려고 주입값은 ref로 읽는다(useSession의 clockRef와 같은 이유).
  const depsRef = useRef(deps)
  depsRef.current = deps

  const start = useCallback(() => {
    const { drawSeed = defaultDrawSeed, pool } = depsRef.current
    const nextSeed = drawSeed()
    setSeed(nextSeed)
    // 카운트다운 기준은 여기서 잡지 않는다. 게임 공개 연출(GameReveal)이 4초 가까이
    // 걸려서, 시작 버튼을 누른 시각으로 잡으면 카운트다운이 통째로 지나가 버린다.
    // 방 세션은 서버가 리드타임(c_lead_sec 9초)으로 그 여유를 주지만 혼자 하기엔
    // 서버가 없으므로, 공개가 끝나는 순간(LINEUP_SHOWN)에 잡는다.
    setStartsAtMs(null)
    dispatch({ type: 'BEGIN', state: initSession(planSession(nextSeed, pool)) })
  }, [])

  const advance = useCallback((event: SessionEvent) => {
    dispatch(event)
    // 카운트다운으로 들어가는 두 길목 — 게임 공개가 끝났을 때(1판)와 판 결과가
    // 끝났을 때(2·3판) — 에서 그 판의 기준 시각을 새로 잡는다. 마지막 판이면
    // phase가 final로 가서 카운트다운이 렌더되지 않으므로 무해하다.
    if (event.type === 'LINEUP_SHOWN' || event.type === 'ROUND_RESULT_DONE') {
      const { now = Date.now } = depsRef.current
      setStartsAtMs(now() + BRIEFING_MS)
    }
  }, [])

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
    setStartsAtMs(null)
    setSeed(null)
  }, [])

  return { state, startsAtMs, seed, start, advance, reset }
}
