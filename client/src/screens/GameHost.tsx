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

/**
 * 모듈이 제한시간 안에 응답을 안 줄 때를 대비한 여유(ms).
 *
 * 2000이던 것을 5000으로 늘렸다. 게임 중에는 제 시간을 다 쓰기 전에 자기
 * 연출을 끼우는 것들이 있다 — plusminus·gugudan은 시작 전 3초 카운트다운,
 * cardmatch는 판 미리보기 동안 시계를 멈춘다. 그래서 실제 종료가
 * 23초·22초까지 밀리는데, 여유가 2초면 호스트가 22초에 먼저 잘라버려서
 * 아무리 잘해도 0점(normalizedScore:0, finished:false)이 제출됐다.
 *
 * 이 타이머는 "모듈이 멈췄나"를 잡는 안전망이지 진행을 재는 시계가 아니다.
 * 몇 초 더 기다려도 목적을 해치지 않는다.
 *
 * ⚠️ 근본 해결은 아니다. timeLimitSec가 호스트와의 약속인데 그걸 넘기는
 * 게임이 있다는 것 자체가 계약 위반이다. 게임 담당자와 정리해야 한다.
 */
export const FORCE_FINISH_GRACE_MS = 5000

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
