import React, { useEffect, useMemo, useRef, useState } from 'react'
import { GestureResponderEvent, LayoutChangeEvent, StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../theme'
import type { GameModule, GameProps } from '../types'
import { Scene } from './Scene'
import { computeResult, DIFF_COUNT, makeScene, patchAt, WRONG_LOCK_MS } from './logic'

/** 두 그림 사이 간격 */
const BOARD_GAP = 12

/**
 * 틀린 그림 찾기 — 동물 사진판.
 *
 * Unsplash의 동물 사진 한 장을 두 번 보여주고, 아래 사진만 몇 군데 고쳐 둔다.
 * 고치는 방법은 사진 자신의 픽셀을 밀거나 뒤집는 것이라 털결과 색감이 원본 그대로 섞인다.
 *
 * 이미지는 빌드 시점에 번들되어 있다 — 게임 중 네트워크 통신은 0이다.
 */
function SpotDiffGame({ seed, timeLimitSec, onFinish }: GameProps) {
  const [sceneIndex, setSceneIndex] = useState(0)
  const [found, setFound] = useState<string[]>([])
  const [foundCount, setFoundCount] = useState(0)
  const [isOver, setIsOver] = useState(false)
  const [isWrong, setIsWrong] = useState(false)
  const [boardWidth, setBoardWidth] = useState(0)

  const scene = useMemo(() => makeScene(seed, sceneIndex), [seed, sceneIndex])
  const alteredPatches = useMemo(
    () => scene.photo.patches.filter((p) => scene.patchIds.includes(p.id)),
    [scene],
  )

  // 시계는 하나뿐이다. 틱을 세면 앱이 백그라운드로 갔을 때 시간이 늘어나 공정성이 깨진다.
  const deadlineRef = useRef(Date.now() + timeLimitSec * 1000)
  const startedAtRef = useRef(Date.now())
  const [timeLeft, setTimeLeft] = useState(timeLimitSec)

  const foundCountRef = useRef(0)
  const lastFoundElapsedMsRef = useRef(0)
  const lockedUntilRef = useRef(0)
  const finishedRef = useRef(false)
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  /** 정확히 한 번만 호출한다. 중도 이탈(언마운트)만 completed=false다. */
  const finish = (completed: boolean) => {
    if (finishedRef.current) return
    finishedRef.current = true
    onFinishRef.current(
      computeResult({
        foundCount: foundCountRef.current,
        lastFoundElapsedMs: lastFoundElapsedMsRef.current,
        timeLimitSec,
        finished: completed,
      }),
    )
  }

  useEffect(() => {
    const tick = () => {
      const remainMs = deadlineRef.current - Date.now()
      setTimeLeft(Math.max(0, Math.ceil(remainMs / 1000)))
      if (remainMs <= 0) {
        setIsOver(true)
        finish(true)
      }
    }
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [])

  // 중도 이탈. 이미 끝났으면 finishedRef가 막는다.
  useEffect(() => () => finish(false), [])

  /** 그림 한 장의 폭을 남은 공간에서 뽑는다. 두 장이 세로로 다 들어가야 한다. */
  const handleBoardsLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    if (width <= 0 || height <= 0) return
    const byHeight = ((height - BOARD_GAP) / 2) * scene.photo.aspect
    setBoardWidth(Math.floor(Math.min(width, byHeight)))
  }

  const boardHeight = boardWidth / scene.photo.aspect

  /**
   * 누른 지점을 0~1 좌표로 바꿔 어느 곳인지 찾는다.
   *
   * Pressable의 onPress는 React Native Web에서 locationX/locationY를 주지 않는다.
   * responder 이벤트는 준다 — 그래서 onResponderRelease를 쓴다.
   */
  const handleScenePress = (event: GestureResponderEvent) => {
    if (isOver || finishedRef.current) return
    if (Date.now() < lockedUntilRef.current) return
    if (boardWidth <= 0) return

    const x = event.nativeEvent.locationX / boardWidth
    const y = event.nativeEvent.locationY / boardHeight
    const patch = patchAt(scene.photo, x, y)

    // 이미 찾은 곳을 다시 누른 것은 실수지 오답이 아니다. 벌하지 않는다.
    if (patch && found.includes(patch.id)) return

    // 맞힌 게 아니면 전부 오답이다. 빈 곳도 마찬가지다 —
    // 사진 대부분은 고친 자리가 아니라서, 빈 곳이 공짜면 마구 두드리는 게 이긴다.
    if (!patch || !scene.patchIds.includes(patch.id)) {
      lockedUntilRef.current = Date.now() + WRONG_LOCK_MS
      setIsWrong(true)
      setTimeout(() => setIsWrong(false), WRONG_LOCK_MS)
      return
    }

    lastFoundElapsedMsRef.current = Date.now() - startedAtRef.current
    foundCountRef.current += 1
    setFoundCount(foundCountRef.current)
    setIsWrong(false)

    const nextFound = [...found, patch.id]
    if (nextFound.length >= DIFF_COUNT) {
      setFound([])
      setSceneIndex((i) => i + 1)
    } else {
      setFound(nextFound)
    }
  }

  const renderBoard = (side: 'left' | 'right') => (
    <View
      testID={`scene-${side}`}
      style={[styles.board, { width: boardWidth, height: boardHeight }]}
      onStartShouldSetResponder={() => true}
      onResponderRelease={handleScenePress}
    >
      <Scene
        photo={scene.photo}
        patches={side === 'right' ? alteredPatches : []}
        found={found}
      />
    </View>
  )

  return (
    <View testID="game-root" style={styles.container}>
      <View style={styles.hud}>
        <View>
          <Text style={styles.hudLabel}>찾은 개수</Text>
          <Text testID="found-count" style={styles.count}>
            {foundCount}
          </Text>
        </View>
        <View style={styles.hudRight}>
          <Text style={styles.hudLabel}>남은 시간</Text>
          <Text testID="time-left" style={[styles.timer, timeLeft <= 5 && styles.timerUrgent]}>
            {timeLeft}
          </Text>
        </View>
      </View>

      <Text style={styles.prompt}>아래 사진에서 고쳐진 곳 {DIFF_COUNT}군데를 찾아 눌러</Text>

      <View testID="boards" style={styles.boards} onLayout={handleBoardsLayout}>
        {renderBoard('left')}
        {renderBoard('right')}

        {/* 틀린 곳을 눌렀다는 신호. 잠긴 동안 화면 한가운데를 덮는다. */}
        {isWrong && (
          <View testID="wrong-mark" pointerEvents="none" style={styles.wrongOverlay}>
            <Text style={styles.wrongMark}>✕</Text>
          </View>
        )}
      </View>

      <Text style={styles.hint}>
        {isWrong ? '거기는 그대로야!' : scene.photo.subject}
      </Text>

      {/* 테스트가 진행 상태를 확인하는 통로 */}
      <Text testID="scene-index" style={styles.hidden}>
        {sceneIndex}
      </Text>
      <Text testID="scene-state" style={styles.hidden}>
        {scene.patchIds.join(',')}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: COLORS.bg },
  hud: { flexDirection: 'row', justifyContent: 'space-between' },
  hudRight: { alignItems: 'flex-end' },
  hudLabel: { color: COLORS.textMuted, fontSize: 13, marginBottom: 2 },
  count: { color: COLORS.accent, fontSize: 40, fontWeight: '800' },
  timer: { color: COLORS.text, fontSize: 40, fontWeight: '800' },
  timerUrgent: { color: COLORS.bad },
  prompt: { color: COLORS.textMuted, fontSize: 15, textAlign: 'center', marginTop: 4 },
  boards: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: BOARD_GAP },
  board: { borderRadius: 10, overflow: 'hidden', backgroundColor: COLORS.surface },
  wrongOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrongMark: {
    color: COLORS.bad,
    fontSize: 180,
    fontWeight: '900',
    // 사진 위에 떠도 보이도록 테두리를 준다
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  hint: { color: COLORS.textFaint, fontSize: 12, marginTop: 6, textAlign: 'center' },
  hidden: { height: 0, opacity: 0 },
})

export const spotDiff: GameModule = {
  info: {
    id: 'spotDiff',
    name: '틀린 그림 찾기',
    emoji: '🐹',
    desc: '동물 사진 두 장에서 고쳐진 곳을 찾아라',
    timeLimitSec: 20,
  },
  Component: SpotDiffGame,
}
