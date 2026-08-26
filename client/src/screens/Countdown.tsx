import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, fonts } from '../theme/colors'

export interface CountdownProps {
  /** 서버 보정 시각 기준 시작 시각(ms) */
  startsAtMs: number
  /** 서버 보정된 "지금"(ms)을 돌려준다. 폰 시계가 아니라 이걸 기준으로 맞춘다. */
  now: () => number
  gameEmoji: string
  gameName: string
  gameDesc: string
  timeLimitSec: number
  /** 시작 시각에 도달하면 정확히 한 번 부른다 (COUNTDOWN_DONE) */
  onDone: () => void
}

const TICK_MS = 100

/** S5 — 3·2·1. 폰 시계가 아니라 서버 보정 시각 기준으로 전원이 동시에 끝난다. */
export function Countdown({
  startsAtMs,
  now,
  gameEmoji,
  gameName,
  gameDesc,
  timeLimitSec,
  onDone,
}: CountdownProps) {
  const [remainingSec, setRemainingSec] = useState(() => Math.ceil((startsAtMs - now()) / 1000))
  const doneRef = useRef(false)

  useEffect(() => {
    const timer = setInterval(() => {
      const sec = Math.ceil((startsAtMs - now()) / 1000)
      setRemainingSec(sec)
      if (sec <= 0 && !doneRef.current) {
        doneRef.current = true
        onDone()
      }
    }, TICK_MS)
    return () => clearInterval(timer)
  }, [startsAtMs, now, onDone])

  return (
    <View style={styles.screen}>
      <Text style={styles.emoji}>{gameEmoji}</Text>
      <Text style={styles.gameName}>{gameName}</Text>
      <Text style={styles.desc}>{gameDesc}</Text>
      <Text style={styles.count}>{Math.max(remainingSec, 0) || '시작!'}</Text>
      <Text style={styles.meta}>{`제한시간 ${timeLimitSec}초`}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emoji: {
    fontSize: 40,
  },
  gameName: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.textPrimary,
  },
  desc: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  count: {
    fontFamily: fonts.heading,
    fontSize: 96,
    color: colors.primary,
    marginTop: 8,
  },
  meta: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
  },
})
