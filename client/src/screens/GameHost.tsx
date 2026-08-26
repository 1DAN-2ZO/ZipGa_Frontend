import { useEffect, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import { getGame } from '../games/registry'
import type { GameResult } from '../games/types'
import { colors } from '../theme/colors'

export interface GameHostProps {
  gameId: string
  seed: number
  timeLimitSec: number
  onFinish: (result: GameResult) => void
}

/** 모듈이 제한시간 안에 응답을 안 줄 때를 대비한 여유(ms). 게임 자체 타이머와 겹치지 않게 넉넉히 둔다. */
const FORCE_FINISH_GRACE_MS = 2000

/**
 * S6 — 게임 호스트. 미니게임 모듈을 띄우는 껍데기.
 *
 * 계약(mdfile/프론트엔드_화면명세.md S6): 제한시간이 지나도 모듈이 onFinish를
 * 안 부르면 강제 종료하고 finished:false로 제출한다. 부분 점수를 host는 알 수 없으니
 * 0점으로 처리한다 — 정상 동작하는 게임이라면 절대 이 경로를 안 탄다.
 */
export function GameHost({ gameId, seed, timeLimitSec, onFinish }: GameHostProps) {
  const finishedRef = useRef(false)
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  const game = getGame(gameId)

  const handleFinish = (result: GameResult) => {
    if (finishedRef.current) return
    finishedRef.current = true
    onFinishRef.current(result)
  }

  useEffect(() => {
    finishedRef.current = false
    const timer = setTimeout(() => {
      if (finishedRef.current) return
      finishedRef.current = true
      onFinishRef.current({ normalizedScore: 0, score: 0, tiebreakMs: timeLimitSec * 1000, finished: false })
    }, timeLimitSec * 1000 + FORCE_FINISH_GRACE_MS)
    return () => clearTimeout(timer)
  }, [gameId, seed, timeLimitSec])

  return (
    <View style={styles.screen}>
      <game.Component
        key={`${gameId}-${seed}`}
        seed={seed}
        timeLimitSec={timeLimitSec}
        onFinish={handleFinish}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
})
