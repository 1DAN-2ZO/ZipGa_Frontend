import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { GameModule, GameProps } from '../types'
import { buildSpawns, HOLE_COUNT, MOLE_COUNT, netScore, normalize } from './logic'

/** 화면 갱신 주기. 스케줄이 절대 시각 기반이라 이 값이 정확도를 좌우하지 않는다. */
const TICK_MS = 50

/** 폭탄을 쳤을 때 붉게 번쩍이는 시간. */
const BLAST_MS = 350

function WhackAMoleGame({ seed, timeLimitSec, onFinish }: GameProps) {
  const durationMs = timeLimitSec * 1000

  const [spawns] = useState(() => buildSpawns(seed, durationMs))
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
      normalizedScore: normalize(score),
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
    if (spawns[index].kind === 'bomb') setBlastAtMs(now)
    setElapsedMs(now)
  }

  const { moleHits, bombHits } = tally()
  const remainSec = Math.max(0, Math.ceil((durationMs - elapsedMs) / 1000))
  const blasting = blastAtMs !== null && elapsedMs - blastAtMs < BLAST_MS

  return (
    <View style={[styles.container, blasting && styles.containerBlast]}>
      <View style={styles.hud}>
        <Text style={styles.hudText} testID="score">
          {`${netScore(moleHits, bombHits)} / ${MOLE_COUNT}`}
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

      <View style={styles.grid}>
        {Array.from({ length: HOLE_COUNT }, (_, hole) => {
          const index = openByHole.get(hole)
          const up = index !== undefined && !struckRef.current.has(index)
          const face = up ? (spawns[index].kind === 'bomb' ? '💣' : '🐹') : ''
          return (
            <Pressable
              key={hole}
              testID={`hole-${hole}`}
              style={styles.hole}
              onPress={() => strike(hole)}
            >
              <Text style={styles.face}>{face}</Text>
            </Pressable>
          )
        })}
      </View>

      <Text style={styles.hint}>💣 은 치지 마세요</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 20 },
  containerBlast: { backgroundColor: '#FFE3E7' },
  hud: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  hudText: { fontSize: 20, fontWeight: '700', color: '#1A1C1C' },
  penalty: { fontSize: 16, fontWeight: '700', color: '#D9345B' },
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
  face: { fontSize: 52 },
  hint: { fontSize: 13, color: '#77767E' },
})

export const whackAMole: GameModule = {
  info: {
    id: 'whackAMole',
    name: '두더지 잡기',
    emoji: '🐹',
    desc: '두더지는 잡고 폭탄은 피해서 제한시간 안에 점수 올리기',
    timeLimitSec: 20,
  },
  Component: WhackAMoleGame,
}
