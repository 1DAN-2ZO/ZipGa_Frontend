import React, { useEffect, useMemo, useRef, useState } from 'react'
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native'
import { colors } from '../../theme/colors'
import { useGameSound } from '../../sound'
import type { GameModule, GameProps } from '../types'
import {
  advance,
  buildWaves,
  steerToward,
  TIME_LIMIT_SEC,
  computeResult,
  isHit,
  PLAYER_VISUAL_RATIO,
  type Arena,
  type Bullet,
} from './logic'

/** 시뮬레이션 틱. 실제 경과 시간으로 움직이므로 이 값이 정확도를 좌우하지는 않는다. */
const TICK_MS = 16

/**
 * 탄막 피하기.
 *
 * 사방에서 날아오는 총알을 손가락으로 피한다. 한 발이라도 맞으면 그 자리에서 끝나고,
 * 버틴 시간이 점수가 된다. 제한시간을 다 채우면 만점이다.
 *
 * 공정성은 두 가지로 지킨다.
 * 1. 탄막 전체를 시작 시점에 시드로 확정한다 — 매 프레임 난수를 뽑지 않는다
 * 2. 총알을 프레임 수가 아니라 실제 경과 시간으로 움직인다 — 느린 폰도 같은 시각에 같은 탄막을 본다
 *
 * 네트워크 코드는 없다.
 */
function BulletHellGame({ seed, timeLimitSec, onFinish }: GameProps) {
  const sound = useGameSound()
  const [arena, setArena] = useState<Arena | null>(null)
  const [bullets, setBullets] = useState<Bullet[]>([])
  const [player, setPlayer] = useState({ x: 0, y: 0 })
  const [timeLeft, setTimeLeft] = useState(timeLimitSec)
  const [isDead, setIsDead] = useState(false)

  const limitMs = timeLimitSec * 1000
  const waves = useMemo(
    () => (arena ? buildWaves(seed, arena, limitMs) : []),
    [seed, arena, limitMs],
  )

  const startedAtRef = useRef(0)
  const lastTickRef = useRef(0)
  const nextWaveRef = useRef(0)
  const bulletsRef = useRef<Bullet[]>([])
  const playerRef = useRef(player)
  const finishedRef = useRef(false)
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  /** 정확히 한 번만 호출한다. 맞아 죽는 것도 시간 만료도 정상 종료다. */
  const finish = (survivedMs: number, completed: boolean) => {
    if (finishedRef.current) return
    finishedRef.current = true
    onFinishRef.current(computeResult({ survivedMs, timeLimitSec, finished: completed }))
  }

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    if (width <= 0 || height <= 0 || arena) return

    setArena({ width, height })
    const center = { x: width / 2, y: height / 2 }
    playerRef.current = center
    setPlayer(center)
  }

  // 화면 크기를 받은 뒤에야 시뮬레이션이 시작된다.
  useEffect(() => {
    if (!arena) return

    startedAtRef.current = Date.now()
    lastTickRef.current = Date.now()

    // 시뮬레이션의 정본은 ref다. state는 그리기 위한 사본일 뿐이다.
    // setState 업데이터 안에서 물리를 돌리면 충돌 판정이 렌더 시점에 묶여 신뢰할 수 없다.
    const step = () => {
      if (finishedRef.current) return

      const now = Date.now()
      const elapsed = now - startedAtRef.current
      const dtSec = (now - lastTickRef.current) / 1000
      lastTickRef.current = now

      // 등장할 차례가 된 웨이브를 꺼낸다
      const spawned: Bullet[] = []
      while (nextWaveRef.current < waves.length && waves[nextWaveRef.current].atMs <= elapsed) {
        spawned.push(...waves[nextWaveRef.current].bullets)
        nextWaveRef.current += 1
      }

      // 유도탄만 플레이어 쪽으로 방향을 튼다. 출발 위치·시각·개수는 시드가 정하므로
      // 모두가 같은 탄을 같은 자리에서 받고, 이후 궤적만 각자의 조작에 따라 갈린다.
      bulletsRef.current = advance(
        steerToward([...bulletsRef.current, ...spawned], playerRef.current, dtSec),
        dtSec,
        arena,
      )

      setBullets(bulletsRef.current)
      setTimeLeft(Math.max(0, Math.ceil((limitMs - elapsed) / 1000)))

      if (isHit(playerRef.current, bulletsRef.current, arena)) {
        // 총알에 맞았다 — 여기서 판이 끝난다.
        sound.miss()
        setIsDead(true)
        finish(elapsed, true)
        return
      }

      if (elapsed >= limitMs) {
        sound.finish()
        finish(limitMs, true)
      }
    }

    const id = setInterval(step, TICK_MS)
    return () => clearInterval(id)
  }, [arena, waves, limitMs])

  /**
   * 안전망. 화면 크기를 영영 못 받아도 제한시간에는 반드시 끝난다 — 계약이 자체 종료를 요구한다.
   *
   * 이 경로로 끝났다면 플레이어가 화면을 본 적조차 없다는 뜻이므로 만점으로 돌려준다.
   * 렌더 실패는 사람 잘못이 아닌데 0점을 주면 그대로 억울한 강퇴가 된다(설계 §4.10).
   */
  useEffect(() => {
    const id = setTimeout(() => finish(limitMs, true), limitMs)
    return () => clearTimeout(id)
  }, [limitMs])

  // 중도 이탈. 이미 끝났으면 finishedRef가 막는다.
  useEffect(() => () => finish(Date.now() - startedAtRef.current, false), [])

  /**
   * 손가락을 댄 지점. 여기서부터의 이동량만큼만 캐릭터가 따라온다.
   *
   * 누른 자리로 순간이동시키면 총알 사이를 비집고 다니는 게 아니라
   * 안전한 칸을 찍는 게임이 된다. 손가락과 캐릭터가 겹치지 않아서
   * 캐릭터가 손에 가리지도 않는다.
   */
  const dragFromRef = useRef<{ x: number; y: number } | null>(null)

  const startDrag = (x: number, y: number) => {
    dragFromRef.current = { x, y }
  }

  /** 끈 만큼 옮긴다. 화면 밖으로 나가면 무적이 되므로 안쪽으로 가둔다. */
  const dragPlayer = (x: number, y: number) => {
    if (!arena || finishedRef.current) return

    const from = dragFromRef.current ?? { x, y }
    dragFromRef.current = { x, y }

    const next = {
      x: Math.min(arena.width, Math.max(0, playerRef.current.x + (x - from.x))),
      y: Math.min(arena.height, Math.max(0, playerRef.current.y + (y - from.y))),
    }
    playerRef.current = next
    setPlayer(next)
  }

  const playerSize = arena ? PLAYER_VISUAL_RATIO * Math.min(arena.width, arena.height) * 2 : 0

  return (
    <View testID="game-root" style={styles.container}>
      <View style={styles.hud}>
        <View>
          <Text style={styles.hudLabel}>버틴 시간</Text>
          <Text testID="survived" style={styles.survived}>
            {(Math.max(0, timeLimitSec - timeLeft)).toFixed(0)}초
          </Text>
        </View>
        <View style={styles.hudRight}>
          <Text style={styles.hudLabel}>남은 시간</Text>
          <Text testID="time-left" style={[styles.timer, timeLeft <= 5 && styles.timerUrgent]}>
            {timeLeft}
          </Text>
        </View>
      </View>

      <View
        testID="arena"
        style={styles.arena}
        onLayout={handleLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => startDrag(e.nativeEvent.locationX, e.nativeEvent.locationY)}
        onResponderMove={(e) => dragPlayer(e.nativeEvent.locationX, e.nativeEvent.locationY)}
        onResponderRelease={() => {
          dragFromRef.current = null
        }}
      >
        {bullets.map((b, i) => (
          <View
            key={i}
            testID="bullet"
            // 총알이 터치를 받으면 locationX/Y가 총알 기준으로 바뀌어 캐릭터가 순간이동한다
            pointerEvents="none"
            style={[
              styles.bullet,
              // 쫓아오는 놈은 한눈에 달라 보여야 한다. 모르고 맞으면 억울하다.
              (b.homingMsLeft ?? 0) > 0 && styles.bulletHoming,
              {
                left: b.x - b.radius,
                top: b.y - b.radius,
                width: b.radius * 2,
                height: b.radius * 2,
                borderRadius: b.radius,
              },
            ]}
          />
        ))}

        {arena && (
          <View
            testID="player"
            pointerEvents="none"
            style={[
              styles.player,
              isDead && styles.playerDead,
              {
                left: player.x - playerSize / 2,
                top: player.y - playerSize / 2,
                width: playerSize,
                height: playerSize,
                borderRadius: playerSize / 2,
              },
            ]}
          />
        )}
      </View>

      <Text style={styles.hint}>
        {isDead ? '맞았다!' : '손가락으로 끌어서 피해'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: colors.background },
  hud: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  hudRight: { alignItems: 'flex-end' },
  hudLabel: { color: colors.textMuted, fontSize: 13, marginBottom: 2 },
  survived: { color: colors.primary, fontSize: 44, fontWeight: '800' },
  timer: { color: colors.textPrimary, fontSize: 44, fontWeight: '800' },
  timerUrgent: { color: colors.danger },
  arena: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    overflow: 'hidden',
  },
  bullet: { position: 'absolute', backgroundColor: colors.danger },
  bulletHoming: { backgroundColor: colors.secondary, borderWidth: 2, borderColor: colors.primary },
  player: { position: 'absolute', backgroundColor: colors.textPrimary },
  playerDead: { backgroundColor: colors.textMuted },
  hint: { color: colors.textMuted, fontSize: 13, marginTop: 10, textAlign: 'center' },
})

export const bulletHell: GameModule = {
  info: {
    id: 'bulletHell',
    name: '탄막 피하기',
    emoji: '💥',
    desc: '사방에서 날아오는 총알을 피해 오래 버티기',
    timeLimitSec: TIME_LIMIT_SEC,
  },
  Component: BulletHellGame,
}
