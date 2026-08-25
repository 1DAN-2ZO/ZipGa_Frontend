import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { GameModule, GameProps } from '../types'
import { buildMoles, HOLE_COUNT, MOLE_COUNT, normalize } from './logic'

/** 화면 갱신 주기. 스케줄이 절대 시각 기반이라 이 값이 정확도를 좌우하지 않는다. */
const TICK_MS = 50

function WhackAMoleGame({ seed, timeLimitSec, onFinish }: GameProps) {
  const durationMs = timeLimitSec * 1000

  const [moles] = useState(() => buildMoles(seed, durationMs))
  const [elapsedMs, setElapsedMs] = useState(0)

  const startedAtRef = useRef(Date.now())
  const hitRef = useRef<Set<number>>(new Set())
  const finishedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  // 완주와 시간 만료가 겹쳐도 정확히 한 번만 부른다.
  const finish = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    // 끝난 뒤에도 틱이 돌면 언마운트된 컴포넌트를 건드린다.
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    onFinishRef.current({
      normalizedScore: normalize(hitRef.current.size),
      score: hitRef.current.size,
      tiebreakMs: Date.now() - startedAtRef.current,
      finished: true,
    })
  }

  useEffect(() => {
    timerRef.current = setInterval(() => {
      const now = Date.now() - startedAtRef.current
      setElapsedMs(now)
      // 제한시간이 끝나면 스스로 종료하고 그때까지 잡은 수를 반환한다.
      if (now >= durationMs) finish()
    }, TICK_MS)
    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [durationMs])

  /** 지금 열려 있는 구멍 → 그 두더지의 인덱스 */
  const openByHole = new Map<number, number>()
  moles.forEach((m, index) => {
    if (m.showAtMs <= elapsedMs && elapsedMs < m.hideAtMs) {
      openByHole.set(m.hole, index)
    }
  })

  const whack = (hole: number) => {
    if (finishedRef.current) return
    const index = openByHole.get(hole)
    // 빈 구멍을 쳐도 감점하지 않는다. 놓치는 것 자체가 이미 페널티다.
    if (index === undefined) return
    hitRef.current.add(index)
    setElapsedMs(Date.now() - startedAtRef.current)
  }

  const remainSec = Math.max(0, Math.ceil((durationMs - elapsedMs) / 1000))

  return (
    <View style={styles.container}>
      <View style={styles.hud}>
        <Text style={styles.hudText} testID="score">
          {`${hitRef.current.size} / ${MOLE_COUNT}`}
        </Text>
        <Text style={styles.hudText} testID="remain">
          {`${remainSec}초`}
        </Text>
      </View>

      <View style={styles.grid}>
        {Array.from({ length: HOLE_COUNT }, (_, hole) => {
          const index = openByHole.get(hole)
          const up = index !== undefined && !hitRef.current.has(index)
          return (
            <Pressable
              key={hole}
              testID={`hole-${hole}`}
              style={styles.hole}
              onPress={() => whack(hole)}
            >
              <Text style={styles.mole}>{up ? '🐹' : ''}</Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 20 },
  hud: { flexDirection: 'row', gap: 28 },
  hudText: { fontSize: 20, fontWeight: '700', color: '#1A1C1C' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: 330,
    gap: 10,
  },
  hole: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#D8D4CE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mole: { fontSize: 52 },
})

export const whackAMole: GameModule = {
  info: {
    id: 'whackAMole',
    name: '두더지 잡기',
    emoji: '🐹',
    desc: '튀어나오는 두더지를 제한시간 안에 몇 마리나 잡을 수 있나',
    timeLimitSec: 20,
  },
  Component: WhackAMoleGame,
}
