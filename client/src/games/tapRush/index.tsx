import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { GameModule, GameProps } from '../types'
import { isComplete, normalize, TARGET_TAPS } from './logic'

/** 남은 시간 표시 갱신 주기. 타수는 탭할 때마다 따로 갱신된다. */
const TICK_MS = 100

function TapRushGame({ seed, timeLimitSec, onFinish }: GameProps) {
  // 이 게임에는 무작위 요소가 없어 seed를 쓰지 않는다.
  // 전원이 같은 조건이므로 파생시킬 대상 자체가 없다.
  void seed

  const durationMs = timeLimitSec * 1000

  const [taps, setTaps] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)

  const startedAtRef = useRef(Date.now())
  const tapsRef = useRef(0)
  const finishedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  // 목표 도달과 시간 만료가 겹쳐도 정확히 한 번만 부른다.
  // 둘 다 정상 종료다 — finished는 중도 이탈만 false로 구분한다.
  const finish = () => {
    if (finishedRef.current) return
    finishedRef.current = true
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    onFinishRef.current({
      normalizedScore: normalize(tapsRef.current),
      score: tapsRef.current,
      tiebreakMs: Date.now() - startedAtRef.current,
      finished: true,
    })
  }

  useEffect(() => {
    timerRef.current = setInterval(() => {
      const now = Date.now() - startedAtRef.current
      setElapsedMs(now)
      // 제한시간이 끝나면 스스로 종료하고 그때까지의 타수를 반환한다.
      if (now >= durationMs) finish()
    }, TICK_MS)
    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [durationMs])

  const tap = () => {
    if (finishedRef.current) return
    tapsRef.current += 1
    setTaps(tapsRef.current)
    // 목표를 채우면 시간이 남아도 즉시 끝낸다. 먼저 채운 사람이 먼저 끝나야
    // 만점자끼리 순위가 갈린다.
    if (isComplete(tapsRef.current)) finish()
  }

  const remainSec = Math.max(0, Math.ceil((durationMs - elapsedMs) / 1000))
  const progress = Math.min(1, taps / TARGET_TAPS)

  return (
    <Pressable testID="tap-area" style={styles.area} onPress={tap}>
      <Text style={styles.remain} testID="remain">{`${remainSec}초`}</Text>

      <Text style={styles.count} testID="taps">
        {taps}
      </Text>
      <Text style={styles.target}>{`/ ${TARGET_TAPS}`}</Text>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>

      <Text style={styles.hint}>아무 데나 두드리세요</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  area: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 24 },
  remain: { fontSize: 20, fontWeight: '700', color: '#1A1C1C', marginBottom: 20 },
  count: { fontSize: 96, fontWeight: '800', color: '#A161F7' },
  target: { fontSize: 16, fontWeight: '600', color: '#77767E' },
  track: {
    width: '100%',
    maxWidth: 280,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E0E0E0',
    marginTop: 24,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: '#A161F7' },
  hint: { fontSize: 13, color: '#77767E', marginTop: 24 },
})

export const tapRush: GameModule = {
  info: {
    id: 'tapRush',
    name: '많이 두드리기',
    emoji: '👊',
    desc: '제한시간 안에 화면을 최대한 많이 두드리기',
    timeLimitSec: 20,
  },
  Component: TapRushGame,
}
