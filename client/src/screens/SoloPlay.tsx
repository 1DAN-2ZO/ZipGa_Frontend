import { useCallback } from 'react'
import { getGame } from '../games/registry'
import type { GameResult } from '../games/types'
import { PENALTY_THRESHOLD } from '../games/types'
import { currentRound, sessionAverage } from '../session/machine'
import { useSolo } from '../solo/useSolo'
import { useAppSound } from '../sound'
import { Countdown } from './Countdown'
import { GameHost } from './GameHost'
import { GameReveal } from './GameReveal'
import { SoloLobby } from './SoloLobby'
import { SoloResult } from './SoloResult'
import { SoloRoundResult } from './SoloRoundResult'

export interface SoloPlayProps {
  nickname?: string
  /** 첫 화면으로 나간다. 로비에서 뒤로가거나 결과에서 그만할 때. */
  onExit: () => void
  onSettings: () => void
}

/**
 * 혼자 하기 흐름 전체(로비 → 공개 → 카운트다운 → 게임 → 판 결과 ×3 → 종합 결과).
 *
 * 방 세션은 이 흐름을 App.tsx가 직접 들고 있는데, 그쪽은 Realtime·프레즌스·
 * 강퇴까지 얽혀 있어서다. 혼자 하기는 서버에 걸린 게 하나도 없으니 화면 하나로
 * 닫아둔다 — App.tsx는 'Solo' 한 줄만 알면 된다.
 */
export function SoloPlay({ nickname, onExit, onSettings }: SoloPlayProps) {
  const solo = useSolo()
  const sound = useAppSound()
  const { state, advance } = solo

  const now = useCallback(() => Date.now(), [])

  const handleRevealDone = useCallback(() => advance({ type: 'LINEUP_SHOWN' }), [advance])

  const handleCountdownDone = useCallback(() => {
    sound.go()
    advance({ type: 'COUNTDOWN_DONE' })
  }, [advance, sound])

  const handleRoundFinished = useCallback(
    (result: GameResult) => advance({ type: 'ROUND_FINISHED', result }),
    [advance],
  )

  const handleRoundResultDone = useCallback(() => advance({ type: 'ROUND_RESULT_DONE' }), [advance])

  if (state === null) {
    return (
      <SoloLobby
        nickname={nickname}
        onStart={solo.start}
        onBack={onExit}
        onSettings={onSettings}
      />
    )
  }

  if (state.phase === 'final') {
    return (
      <SoloResult
        rounds={state.plan.map((round, index) => {
          const info = getGame(round.gameId).info
          return {
            gameName: info.name,
            gameEmoji: info.emoji,
            normalizedScore: state.results[index]?.normalizedScore ?? 0,
          }
        })}
        average={sessionAverage(state) ?? 0}
        threshold={PENALTY_THRESHOLD}
        seed={solo.seed ?? 0}
        onRestart={solo.start}
        onExit={onExit}
        onSettings={onSettings}
      />
    )
  }

  if (state.phase === 'lineup') {
    return <GameReveal plan={state.plan} onDone={handleRevealDone} />
  }

  const round = currentRound(state)
  const info = getGame(round.gameId).info

  if (state.phase === 'countdown') {
    // startsAtMs는 LINEUP_SHOWN·ROUND_RESULT_DONE에서 잡히므로 이 시점엔 항상 값이 있다.
    return (
      <Countdown
        startsAtMs={solo.startsAtMs ?? Date.now()}
        now={now}
        gameEmoji={info.emoji}
        gameName={info.name}
        gameDesc={info.desc}
        timeLimitSec={round.timeLimitSec}
        onDone={handleCountdownDone}
      />
    )
  }

  if (state.phase === 'playing') {
    return (
      <GameHost
        gameId={round.gameId}
        seed={round.seed}
        timeLimitSec={round.timeLimitSec}
        onFinish={handleRoundFinished}
      />
    )
  }

  return (
    <SoloRoundResult
      gameName={info.name}
      roundIndex={state.roundIndex}
      normalizedScore={state.results[state.roundIndex]?.normalizedScore ?? 0}
      onDone={handleRoundResultDone}
    />
  )
}
