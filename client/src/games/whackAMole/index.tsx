import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { GestureResponderEvent } from 'react-native'
import { useGameSound } from '../../sound'
import type { GameModule, GameProps } from '../types'
import { COLORS } from '../../theme'
import {
  buildSpawns,
  countMoles,
  HOLE_COUNT,
  HOLE_GAP,
  holeAt,
  HOLE_SIZE,
  netScore,
  normalize,
  TIME_LIMIT_SEC,
} from './logic'

/** 화면 갱신 주기. 스케줄이 절대 시각 기반이라 이 값이 정확도를 좌우하지 않는다. */
const TICK_MS = 50

/** 폭탄을 쳤을 때 붉게 번쩍이는 시간. */
const BLAST_MS = 350

// 제한시간은 넘겨받지 않고 고정한다. 스케줄이 "웨이브 간격 × 웨이브 수"로
// 짜여서 길이가 바뀌면 등장 리듬이 통째로 달라진다. info.timeLimitSec도 같은
// 값이라 호스트의 강제 종료 타이머와 어긋나지 않는다.
function WhackAMoleGame({ seed, onFinish }: GameProps) {
  const durationMs = TIME_LIMIT_SEC * 1000

  const sound = useGameSound()
  const [spawns] = useState(() => buildSpawns(seed, durationMs))
  // 한 웨이브에 1~2개가 랜덤이라 총 마릿수가 시드마다 다르다. 점수는 이 값으로 나눈다.
  const [moleCount] = useState(() => countMoles(spawns))
  const [elapsedMs, setElapsedMs] = useState(0)
  const [blastAtMs, setBlastAtMs] = useState<number | null>(null)

  const startedAtRef = useRef(Date.now())
  /** 이미 친 등장물의 인덱스. 같은 것을 두 번 쳐도 한 번만 센다. */
  const struckRef = useRef<Set<number>>(new Set())
  const finishedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  const tally = () => {
    let moleHits = 0
    let bombHits = 0
    for (const index of struckRef.current) {
      if (spawns[index].kind === 'bomb') bombHits += 1
      else moleHits += 1
    }
    return { moleHits, bombHits }
  }

  // 완주와 시간 만료가 겹쳐도 정확히 한 번만 부른다.
  const finish = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    // 끝난 뒤에도 틱이 돌면 언마운트된 컴포넌트를 건드린다.
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const { moleHits, bombHits } = tally()
    const score = netScore(moleHits, bombHits)
    onFinishRef.current({
      normalizedScore: normalize(score, moleCount),
      score,
      tiebreakMs: Date.now() - startedAtRef.current,
      finished: true,
    })
  }

  useEffect(() => {
    timerRef.current = setInterval(() => {
      const now = Date.now() - startedAtRef.current
      setElapsedMs(now)
      // 제한시간이 끝나면 스스로 종료하고 그때까지의 점수를 반환한다.
      if (now >= durationMs) finish()
    }, TICK_MS)
    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [durationMs])

  /** 지금 열려 있는 구멍 → 그 등장물의 인덱스 */
  const openByHole = new Map<number, number>()
  spawns.forEach((s, index) => {
    if (s.showAtMs <= elapsedMs && elapsedMs < s.hideAtMs) {
      openByHole.set(s.hole, index)
    }
  })

  const strike = (hole: number) => {
    if (finishedRef.current) return
    const index = openByHole.get(hole)
    // 빈 구멍을 쳐도 감점하지 않는다. 놓치는 것 자체가 이미 페널티다.
    if (index === undefined) return
    if (struckRef.current.has(index)) return

    struckRef.current.add(index)
    const now = Date.now() - startedAtRef.current
    if (spawns[index].kind === 'bomb') {
      setBlastAtMs(now)
      sound.penalty()
    } else {
      sound.hit()
    }
    setElapsedMs(now)
  }

  /**
   * 내려온 손가락을 전부 처리한다.
   *
   * 구멍마다 Pressable 을 두면 두 번째 손가락이 버려진다 — 응답자가 전역에
   * 하나뿐이라 이미 응답자가 있으면 형제 노드는 후보에서 잘려 나간다
   * (react-native-web ResponderSystem 의 공통 조상 가지치기).
   * 그리드 하나가 응답자를 잡고 changedTouches 를 직접 훑는다.
   *
   * changedTouches 는 이번에 새로 눌린 손가락만 담는다. touches 를 쓰면
   * 이미 누르고 있던 손가락까지 매 이벤트마다 다시 처리된다.
   */
  const handleTouches = (e: GestureResponderEvent) => {
    const changed = e.nativeEvent.changedTouches
    const points =
      changed && changed.length > 0
        ? changed
        : // 마우스처럼 changedTouches 가 비는 경우엔 이벤트 자체가 한 점이다
          [e.nativeEvent]
    for (const point of points) {
      const hole = holeAt(point.locationX, point.locationY)
      if (hole !== null) strike(hole)
    }
  }

  const { moleHits, bombHits } = tally()
  const remainSec = Math.max(0, Math.ceil((durationMs - elapsedMs) / 1000))
  const blasting = blastAtMs !== null && elapsedMs - blastAtMs < BLAST_MS

  return (
    <View testID="game-root" style={[styles.container, blasting && styles.containerBlast]}>
      <View style={styles.hud}>
        <Text style={styles.hudText} testID="score">
          {`${netScore(moleHits, bombHits)} / ${moleCount}`}
        </Text>
        {bombHits > 0 && (
          <Text style={styles.penalty} testID="penalty">
            {`💣 -${bombHits}`}
          </Text>
        )}
        <Text style={styles.hudText} testID="remain">
          {`${remainSec}초`}
        </Text>
      </View>

      {/*
        구멍마다 버튼을 두지 않고 그리드 전체가 터치를 받는다.
        두 마리가 동시에 올라오는 게임이라 두 손가락이 같이 먹혀야 한다.
      */}
      <View
        testID="grid"
        style={styles.grid}
        onStartShouldSetResponder={() => true}
        // 손가락을 끌어 다른 구멍으로 옮기는 건 잡은 것으로 치지 않는다.
        // 한 번 누르면 한 마리 — 문질러서 쓸어담을 수 없어야 한다.
        onMoveShouldSetResponder={() => false}
        onResponderStart={handleTouches}
      >
        {Array.from({ length: HOLE_COUNT }, (_, hole) => {
          const index = openByHole.get(hole)
          const up = index !== undefined && !struckRef.current.has(index)
          const face = up ? (spawns[index].kind === 'bomb' ? '💣' : '🐹') : ''
          return (
            <View key={hole} testID={`hole-${hole}`} style={styles.hole}>
              <Text style={styles.face}>{face}</Text>
            </View>
          )
        })}
      </View>

      <Text style={styles.hint}>💣 은 치지 마세요</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  /**
   * userSelect: 연타하는 게임이라 웹에서 글자가 드래그 선택된다.
   * react-native-web은 Text를 선택 가능한 요소로 그리기 때문에, 숫자를
   * 빠르게 두드리면 파랗게 잡히고 커서가 텍스트 선택으로 바뀐다.
   * user-select는 CSS 상속이라 루트에만 걸면 자식 Text까지 따라온다.
   * (selectable prop은 RNW에서 deprecated — styles.userSelect를 쓰라고 경고한다)
   */
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    padding: 20,
    backgroundColor: COLORS.bg,
    userSelect: 'none',
  },
  containerBlast: { backgroundColor: '#FFE3E7' },
  hud: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  hudText: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  penalty: { fontSize: 16, fontWeight: '700', color: COLORS.bad },
  /**
   * 좌표 판정(logic.holeAt)이 같은 값을 쓰므로 여기서 크기를 바꾸면
   * 눌리는 자리가 어긋난다. 상수를 그대로 가져다 쓴다.
   */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: HOLE_SIZE * 3 + HOLE_GAP * 2,
    gap: HOLE_GAP,
  },
  hole: {
    width: HOLE_SIZE,
    height: HOLE_SIZE,
    borderRadius: HOLE_SIZE / 2,
    backgroundColor: '#D8D4CE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  face: { fontSize: 52 },
  hint: { fontSize: 13, color: COLORS.textMuted },
})

export const whackAMole: GameModule = {
  info: {
    id: 'whackAMole',
    name: '두더지 잡기',
    emoji: '🐹',
    desc: '두더지는 잡고 폭탄은 피해서 제한시간 안에 점수 올리기',
    timeLimitSec: TIME_LIMIT_SEC,
  },
  Component: WhackAMoleGame,
}
