import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useGameSound } from '../../sound'
import type { GameModule, GameProps } from '../types'
import { COLORS } from '../../theme'
import { chirp } from './chirp'
import { Egg } from './Egg'
import { crackStage, isComplete, normalize, TARGET_TAPS } from './logic'

/** 남은 시간 표시 갱신 주기. 타수는 탭할 때마다 따로 갱신된다. */
const TICK_MS = 100

/**
 * 부화한 병아리를 보여주는 시간(ms).
 *
 * 목표를 채운 순간 곧장 끝내면 병아리가 한 프레임 스치고 만다. 여기까지
 * 150번을 두드린 보람이 그 그림 하나인데 그걸 못 보고 넘어간다.
 *
 * 순위에는 영향이 없다 — tiebreakMs는 150번째를 친 순간에 재고, 이 지연은
 * 도달한 사람 모두에게 똑같이 붙는다. 호스트의 강제 종료 여유(5초)
 * 안이라 잘리지도 않는다(screens/GameHost.tsx).
 */
export const HATCH_HOLD_MS = 1200

function TapRushGame({ seed, timeLimitSec, onFinish }: GameProps) {
  // 이 게임에는 무작위 요소가 없어 seed를 쓰지 않는다.
  // 전원이 같은 조건이므로 파생시킬 대상 자체가 없다.
  void seed

  const durationMs = timeLimitSec * 1000

  const sound = useGameSound()
  const [taps, setTaps] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)

  const startedAtRef = useRef(Date.now())
  const tapsRef = useRef(0)
  const finishedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const holdRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  // 목표 도달과 시간 만료가 겹쳐도 정확히 한 번만 부른다.
  // 둘 다 정상 종료다 — finished는 중도 이탈만 false로 구분한다.
  //
  // holdMs를 주면 그만큼 늦게 제출한다. 부화 연출을 보여주는 동안에도
  // 더 두드릴 수 없어야 하므로 잠그는 것(finishedRef)은 지금 한다.
  const finish = (holdMs = 0) => {
    if (finishedRef.current) return
    finishedRef.current = true
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    // 걸린 시간은 지금 잰다. 연출 시간이 순위에 섞이면 안 된다.
    const result = {
      normalizedScore: normalize(tapsRef.current),
      score: tapsRef.current,
      tiebreakMs: Date.now() - startedAtRef.current,
      finished: true,
    }
    if (holdMs <= 0) {
      onFinishRef.current(result)
      return
    }
    holdRef.current = setTimeout(() => onFinishRef.current(result), holdMs)
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
      if (holdRef.current !== null) clearTimeout(holdRef.current)
      holdRef.current = null
    }
  }, [durationMs])

  const tap = () => {
    if (finishedRef.current) return
    tapsRef.current += 1
    setTaps(tapsRef.current)
    sound.tick()
    // 목표를 채우면 시간이 남아도 즉시 끝낸다. 먼저 채운 사람이 먼저 끝나야
    // 만점자끼리 순위가 갈린다.
    if (isComplete(tapsRef.current)) {
      // 부화 소리는 삐약 하나로 충분하다. finish()까지 겹치면 뭉개진다.
      chirp()
      finish(HATCH_HOLD_MS)
    }
  }

  const remainSec = Math.max(0, Math.ceil((durationMs - elapsedMs) / 1000))
  const progress = Math.min(1, taps / TARGET_TAPS)
  const hatched = isComplete(taps)

  return (
    <View testID="game-root" style={styles.root}>
      <Pressable testID="tap-area" style={styles.area} onPress={tap}>
        <Text style={styles.remain} testID="remain">{`${remainSec}초`}</Text>

        <View style={styles.eggBox}>
          <Egg stage={crackStage(taps)} hatched={hatched} />
        </View>

        <Text style={styles.count} testID="taps">
          {taps}
        </Text>
        <Text style={styles.target}>{`/ ${TARGET_TAPS}`}</Text>

        <View style={styles.track}>
          <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        </View>

        <Text style={styles.hint} testID="hint">
          {hatched ? '부화!' : '아무 데나 두드리세요'}
        </Text>
      </Pressable>
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
  root: { flex: 1, backgroundColor: COLORS.bg, userSelect: 'none' },
  area: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 24 },
  remain: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  // 계란이 세로로 길어 화면을 많이 먹는다. 숫자를 키우면 힌트가 잘린다.
  eggBox: { width: 150, height: 195, marginVertical: 8 },
  count: { fontSize: 52, fontWeight: '800', color: COLORS.brand },
  target: { fontSize: 16, fontWeight: '600', color: COLORS.textMuted },
  track: {
    width: '100%',
    maxWidth: 280,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.surfaceAlt,
    marginTop: 14,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: COLORS.brand },
  hint: { fontSize: 13, color: COLORS.textMuted, marginTop: 14 },
})

export const tapRush: GameModule = {
  info: {
    id: 'tapRush',
    name: '많이 두드리기',
    emoji: '👊',
    desc: '두드려서 계란을 깨고 병아리를 꺼내기',
    timeLimitSec: 20,
  },
  Component: TapRushGame,
}
