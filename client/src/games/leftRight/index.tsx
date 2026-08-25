import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../../theme'
import type { GameModule, GameProps } from '../types'
import { Backdrop } from './Backdrop'
import { Cat } from './Cat'
import { Queue } from './Queue'
import {
  CAT_QUEUE_LENGTH,
  COLOR_LABELS,
  computeResult,
  EASY_COLORS,
  HARD_COLORS,
  LEFT_COLORS,
  makeCats,
  QUEUE_VISIBLE,
  RAMP_AT,
  RIGHT_COLORS,
  sideOf,
  WRONG_LOCK_MS,
  WRONG_PENALTY,
  type CatColor,
  type Side,
} from './logic'

/** 문지기 고양이 크기 */
const GATE_CAT_SIZE = 62

/** 남은 시간 막대. ratio 1이 가득 찬 상태다. */
function TimerBar({ ratio }: { ratio: number }) {
  const clamped = Math.max(0, Math.min(1, ratio))
  return (
    <View testID="timer-bar" style={styles.timerTrack}>
      <View
        testID="timer-fill"
        style={[
          styles.timerFill,
          { width: `${clamped * 100}%` },
          clamped <= 0.25 && styles.timerFillUrgent,
        ]}
      />
    </View>
  )
}

/**
 * 좌로우로.
 *
 * 줄 서 있는 고양이를 맨 앞부터 자기 색 문지기 쪽으로 보낸다.
 * 뒤에 뭐가 오는지 보이므로 손을 미리 준비할 수 있다.
 * 앞의 몇 마리는 두 색뿐이고 그 뒤로 네 색으로 늘어난다.
 * 제한시간이 끝나면 스스로 종료한다 — 네트워크 코드는 없다(설계 §3.7).
 */
function LeftRightGame({ seed, timeLimitSec, onFinish }: GameProps) {
  // 시작할 때 줄을 통째로 확정한다. 조작이 빠르든 느리든 모두 같은 순서를 본다.
  const cats = useMemo(() => makeCats(seed, CAT_QUEUE_LENGTH), [seed])

  const [catIndex, setCatIndex] = useState(0)
  const [netScore, setNetScore] = useState(0)
  const [isOver, setIsOver] = useState(false)
  const [wrongSide, setWrongSide] = useState<Side | null>(null)

  // 시계는 하나뿐이다. 틱을 세면 앱이 백그라운드로 갔을 때 시간이 늘어나 공정성이 깨진다.
  const deadlineRef = useRef(Date.now() + timeLimitSec * 1000)
  const startedAtRef = useRef(Date.now())
  const [remainMs, setRemainMs] = useState(timeLimitSec * 1000)

  const netScoreRef = useRef(0)
  const lastCorrectElapsedMsRef = useRef(0)
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
        netScore: netScoreRef.current,
        lastCorrectElapsedMs: lastCorrectElapsedMsRef.current,
        timeLimitSec,
        finished: completed,
      }),
    )
  }

  useEffect(() => {
    const tick = () => {
      const left = deadlineRef.current - Date.now()
      setRemainMs(Math.max(0, left))
      if (left <= 0) {
        setIsOver(true)
        finish(true)
      }
    }
    // 막대가 부드럽게 줄어야 해서 1초가 아니라 더 자주 본다.
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [])

  // 중도 이탈. 이미 끝났으면 finishedRef가 막는다.
  useEffect(() => () => finish(false), [])

  const timeLeft = Math.max(0, Math.ceil(remainMs / 1000))

  // 줄 끝은 제한시간 안에 닿지 않는다. 그래도 마지막 조각을 붙잡아 화면이 비지 않게 한다.
  const start = Math.min(catIndex, cats.length - QUEUE_VISIBLE)
  const visible = cats.slice(start, start + QUEUE_VISIBLE)
  const color = visible[0]

  /** 네 색이 나오기 시작했는지. 문지기도 여기에 맞춰 늘어난다. */
  const isHardPhase = catIndex >= RAMP_AT
  const gateColors = isHardPhase ? HARD_COLORS : EASY_COLORS

  const send = (side: Side) => {
    if (isOver || finishedRef.current) return
    if (Date.now() < lockedUntilRef.current) return

    if (side !== sideOf(color)) {
      // 틀렸다. 점수를 깎고 이 고양이는 넘긴다. 잠금은 난타를 막는 별개 장치다.
      netScoreRef.current -= WRONG_PENALTY
      setNetScore(netScoreRef.current)
      lockedUntilRef.current = Date.now() + WRONG_LOCK_MS
      setWrongSide(side)
      setTimeout(() => setWrongSide(null), WRONG_LOCK_MS)
      setCatIndex((i) => i + 1)
      return
    }

    lastCorrectElapsedMsRef.current = Date.now() - startedAtRef.current
    netScoreRef.current += 1
    setNetScore(netScoreRef.current)
    setWrongSide(null)
    setCatIndex((i) => i + 1)
  }

  const renderGate = (gateColor: CatColor) => (
    <View key={gateColor} testID={`gate-${gateColor}`} style={styles.gate}>
      <Cat color={gateColor} size={GATE_CAT_SIZE} testID={`gate-${gateColor}-fur`} />
      <Text style={styles.gateLabel}>{COLOR_LABELS[gateColor]}</Text>
    </View>
  )

  const gatesOf = (side: Side) =>
    (side === 'left' ? LEFT_COLORS : RIGHT_COLORS).filter((c) => gateColors.includes(c))

  const renderButton = (side: Side, glyph: string) => (
    <Pressable
      testID={`send-${side}`}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
        wrongSide === side && styles.buttonWrong,
      ]}
      onPress={() => send(side)}
    >
      <Text style={styles.buttonGlyph}>{glyph}</Text>
    </Pressable>
  )

  return (
    <View testID="game-root" style={styles.container}>
      <Backdrop />

      <View style={styles.topBar}>
        <TimerBar ratio={remainMs / (timeLimitSec * 1000)} />
        <Text testID="time-left" style={[styles.timeText, timeLeft <= 5 && styles.timeTextUrgent]}>
          {timeLeft}
        </Text>
      </View>

      <View style={styles.scoreBlock}>
        <View style={styles.scoreRing}>
          <Text testID="net-score" style={[styles.score, netScore < 0 && styles.scoreNegative]}>
            {netScore}
          </Text>
        </View>
        <Text style={styles.tagline}>이건 이쪽 저건 저쪽</Text>
      </View>

      <View style={styles.field}>
        <View style={styles.gateColumn}>
          <Text style={styles.gateShout}>좌로!</Text>
          {gatesOf('left').map(renderGate)}
        </View>

        <View style={styles.stage}>
          <Queue colors={visible} />
          <Text testID="cat-color" style={styles.catLabel}>
            {COLOR_LABELS[color]}
          </Text>
        </View>

        <View style={styles.gateColumn}>
          <Text style={styles.gateShout}>우로!</Text>
          {gatesOf('right').map(renderGate)}
        </View>
      </View>

      <View style={styles.controls}>
        {renderButton('left', '◀')}
        {renderButton('right', '▶')}
      </View>

      <Text style={styles.hint}>
        {wrongSide !== null ? '거긴 아니야! −1' : isHardPhase ? '색이 넷으로 늘었다' : ' '}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: COLORS.bg },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timerTrack: {
    flex: 1,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 2,
    borderColor: COLORS.text,
    overflow: 'hidden',
  },
  timerFill: { height: '100%', backgroundColor: COLORS.accent },
  timerFillUrgent: { backgroundColor: COLORS.bad },
  timeText: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '800',
    minWidth: 34,
    textAlign: 'right',
  },
  timeTextUrgent: { color: COLORS.bad },

  scoreBlock: { alignItems: 'center', marginTop: 10 },
  scoreRing: {
    minWidth: 74,
    paddingHorizontal: 14,
    paddingVertical: 2,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: COLORS.text,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  score: { color: COLORS.text, fontSize: 40, fontWeight: '800' },
  scoreNegative: { color: COLORS.bad },
  tagline: { color: COLORS.textMuted, fontSize: 15, fontWeight: '700', marginTop: 6 },

  field: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  gateColumn: { width: 76, gap: 10, alignItems: 'center' },
  gateShout: { color: COLORS.text, fontSize: 17, fontWeight: '800' },
  gate: { alignItems: 'center', gap: 2 },
  gateLabel: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700' },

  stage: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  catLabel: { color: COLORS.text, fontSize: 18, fontWeight: '800' },

  controls: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  button: {
    width: 128,
    paddingVertical: 18,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 3,
    borderColor: COLORS.text,
    alignItems: 'center',
    // 두툼한 버튼. 아래쪽을 두껍게 둬서 눌리기 전이라는 게 보인다.
    borderBottomWidth: 9,
  },
  buttonPressed: { borderBottomWidth: 3, marginTop: 6 },
  buttonWrong: { backgroundColor: COLORS.bad },
  buttonGlyph: { color: COLORS.text, fontSize: 30, fontWeight: '800', lineHeight: 34 },

  hint: {
    color: COLORS.textMuted,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
})

export const leftRight: GameModule = {
  info: {
    id: 'leftRight',
    name: '좌로우로',
    emoji: '🐈',
    desc: '고양이를 같은 색 문지기 쪽으로 보내라',
    timeLimitSec: 20,
  },
  Component: LeftRightGame,
}
