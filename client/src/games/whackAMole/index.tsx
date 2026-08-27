import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useGameSound } from '../../sound'
import type { GameModule, GameProps } from '../types'
import { COLORS } from '../../theme'
import { buildSpawns, countMoles, HOLE_COUNT, netScore, normalize, TIME_LIMIT_SEC } from './logic'

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
