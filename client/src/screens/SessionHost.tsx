import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ScreenHeader } from '../components/ScreenHeader'
import { getGame } from '../games/registry'
import type { GameResult } from '../games/types'
import { currentRound } from '../session/machine'
import type { RoundScore } from '../session/realtime'
import { subscribeRoundScores } from '../session/realtime'
import type { SessionHandle } from '../session/useSession'
import { colors, fonts, radius } from '../theme/colors'

/**
 * 세션 진행 껍데기 (프론트엔드_화면명세.md S4~S7).
 *
 * 상태 기계(session/machine.ts)가 지금 어느 단계인지 알려주고, 이 파일은
 * 단계마다 화면을 고른다. 단계를 넘기는 이벤트도 여기서 올린다 —
 * 기계는 스스로 시간을 재지 않는다.
 *
 * ⚠️ Lineup·Countdown·RoundResult 세 화면은 임시 구현이다.
 * 팀에서 S4·S5·S7을 따로 만들고 있으므로, 완성되면 아래 세 컴포넌트만
 * 갈아끼우면 된다. 각 컴포넌트가 받는 props가 곧 교체 지점의 계약이다.
 */

/** 2·3판 카운트다운 길이. 1판은 서버가 준 starts_at을 쓴다. */
const LATER_ROUND_LEAD_MS = 3000

export interface SessionHostProps {
  session: SessionHandle
  myPlayerId: string | null
  onSettings: () => void
}

export function SessionHost({ session, myPlayerId, onSettings }: SessionHostProps) {
  const { state, advance } = session
  if (!state) return null

  const round = currentRound(state)

  switch (state.phase) {
    case 'lineup':
      return <Lineup gameIds={state.plan.map((r) => r.gameId)} onDone={() => advance({ type: 'LINEUP_SHOWN' })} />

    case 'countdown':
      return (
        <Countdown
          gameId={round.gameId}
          timeLimitSec={round.timeLimitSec}
          // 1판만 서버가 출발선을 정한다. 2·3판은 판 결과를 다 본 뒤라 각자 센다.
          targetMs={state.roundIndex === 0 ? session.startsAtMs : null}
          nowMs={session.nowMs}
          onDone={() => advance({ type: 'COUNTDOWN_DONE' })}
        />
      )

    case 'playing':
      return (
        <GameStage
          key={`${round.gameId}-${round.seed}`}
          gameId={round.gameId}
          seed={round.seed}
          timeLimitSec={round.timeLimitSec}
          onFinish={(result) => advance({ type: 'ROUND_FINISHED', result })}
        />
      )

    case 'roundResult':
      return (
        <RoundResult
          sessionId={session.sessionId}
          roundIndex={state.roundIndex}
          myPlayerId={myPlayerId}
          isLastRound={state.roundIndex >= state.plan.length - 1}
          onSettings={onSettings}
          onDone={() => advance({ type: 'ROUND_RESULT_DONE' })}
        />
      )

    case 'final':
      // 종합 결과는 App이 SessionResult로 그린다. 여기서는 그릴 게 없다.
      return null
  }
}

/* ------------------------------------------------------------------ *
 * S4 — 게임 3개 공개 (임시)
 * ------------------------------------------------------------------ */

const LINEUP_HOLD_MS = 2600

function Lineup({ gameIds, onDone }: { gameIds: string[]; onDone: () => void }) {
  // 슬롯머신 연출 대신 하나씩 확정되는 것만 흉내낸다. 연출은 S4가 맡는다.
  const [revealed, setRevealed] = useState(0)

  useEffect(() => {
    const step = LINEUP_HOLD_MS / (gameIds.length + 1)
    const timers = gameIds.map((_, i) => setTimeout(() => setRevealed(i + 1), step * (i + 1)))
    const done = setTimeout(onDone, LINEUP_HOLD_MS)
    return () => {
      timers.forEach(clearTimeout)
      clearTimeout(done)
    }
    // onDone은 매 렌더마다 새 함수라 넣으면 타이머가 계속 다시 걸린다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameIds.length])

  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>오늘의 세 판</Text>
      <View style={styles.centerBody}>
        {gameIds.map((id, i) => {
          const info = getGame(id).info
          const shown = i < revealed
          return (
            <View key={id} style={[styles.card, !shown && styles.cardHidden]}>
              <Text style={styles.cardEmoji}>{shown ? info.emoji : '?'}</Text>
              <View style={styles.cardText}>
                <Text style={styles.cardName}>{shown ? info.name : '???'}</Text>
                {shown && <Text style={styles.cardDesc}>{info.desc}</Text>}
              </View>
            </View>
          )
        })}
      </View>
    </View>
  )
}

/* ------------------------------------------------------------------ *
 * S5 — 카운트다운 (임시)
 * ------------------------------------------------------------------ */

function Countdown({
  gameId,
  timeLimitSec,
  targetMs,
  nowMs,
  onDone,
}: {
  gameId: string
  timeLimitSec: number
  /** 서버가 정한 출발 시각. null이면 지금부터 LATER_ROUND_LEAD_MS 뒤 */
  targetMs: number | null
  nowMs: () => number
  onDone: () => void
}) {
  const info = getGame(gameId).info
  // 목표 시각을 한 번만 고정한다. 매 렌더마다 다시 계산하면 카운트다운이 밀린다.
  const targetRef = useRef(targetMs ?? nowMs() + LATER_ROUND_LEAD_MS)
  const [left, setLeft] = useState(() => targetRef.current - nowMs())

  useEffect(() => {
    const tick = setInterval(() => {
      const remain = targetRef.current - nowMs()
      setLeft(remain)
      if (remain <= 0) {
        clearInterval(tick)
        onDone()
      }
    }, 100)
    return () => clearInterval(tick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const secs = Math.max(0, Math.ceil(left / 1000))

  return (
    <View style={styles.screen}>
      <View style={styles.centerBody}>
        <Text style={styles.countEmoji}>{info.emoji}</Text>
        <Text style={styles.countName}>{info.name}</Text>
        <Text style={styles.countDesc}>{info.desc}</Text>
        <Text testID="countdown" style={styles.countNumber}>
          {secs > 0 ? secs : '시작!'}
        </Text>
        <Text style={styles.countLimit}>{`제한시간 ${timeLimitSec}초`}</Text>
      </View>
    </View>
  )
}

/* ------------------------------------------------------------------ *
 * S6 — 게임 호스트
 * ------------------------------------------------------------------ */

/** 모듈이 제한시간을 넘겨도 안 끝날 때 호스트가 잘라내기까지의 여유. */
const WATCHDOG_GRACE_MS = 3000

function GameStage({
  gameId,
  seed,
  timeLimitSec,
  onFinish,
}: {
  gameId: string
  seed: number
  timeLimitSec: number
  onFinish: (result: GameResult) => void
}) {
  const { Component } = getGame(gameId)
  const doneRef = useRef(false)
  const startedAtRef = useRef(Date.now())

  const finishOnce = (result: GameResult) => {
    if (doneRef.current) return
    doneRef.current = true
    onFinish(result)
  }

  // 모듈이 제한시간이 지나도 반환하지 않으면 강제 종료한다.
  // 한 사람이 안 끝내면 전원이 묶이므로 호스트가 끊어줘야 한다
  // (프론트엔드_화면명세.md S6).
  useEffect(() => {
    const kill = setTimeout(() => {
      finishOnce({
        normalizedScore: 0,
        score: 0,
        tiebreakMs: Date.now() - startedAtRef.current,
        finished: false,
      })
    }, timeLimitSec * 1000 + WATCHDOG_GRACE_MS)
    return () => clearTimeout(kill)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <View style={styles.stage}>
      <Component seed={seed} timeLimitSec={timeLimitSec} onFinish={finishOnce} />
    </View>
  )
}

/* ------------------------------------------------------------------ *
 * S7 — 판 결과 (임시)
 * ------------------------------------------------------------------ */

const ROUND_RESULT_HOLD_MS = 4000

function RoundResult({
  sessionId,
  roundIndex,
  myPlayerId,
  isLastRound,
  onSettings,
  onDone,
}: {
  sessionId: string | null
  roundIndex: number
  myPlayerId: string | null
  isLastRound: boolean
  onSettings: () => void
  onDone: () => void
}) {
  const [scores, setScores] = useState<RoundScore[]>([])

  useEffect(() => {
    if (!sessionId) return
    return subscribeRoundScores(sessionId, roundIndex, setScores)
  }, [sessionId, roundIndex])

  useEffect(() => {
    const t = setTimeout(onDone, ROUND_RESULT_HOLD_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <View style={styles.screen}>
      <ScreenHeader title={`${roundIndex + 1}판 결과`} onSettings={onSettings} />
      <View style={styles.list}>
        {scores.length === 0 && <Text style={styles.waiting}>결과를 기다리는 중…</Text>}
        {scores.map((s, i) => (
          <View key={s.playerId} style={[styles.row, s.playerId === myPlayerId && styles.rowMine]}>
            <Text style={styles.rank}>{i + 1}</Text>
            <Text style={styles.nickname} numberOfLines={1}>
              {s.nickname}
            </Text>
            {/* 누적 평균은 절대 안 보여준다. 3판째까지 긴장을 유지해야 한다 (S7) */}
            <Text style={styles.raw}>{s.rawScore}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.next}>{isLastRound ? '종합 결과로 넘어갑니다' : '다음 판 준비…'}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  stage: { flex: 1, backgroundColor: colors.background },
  heading: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: colors.primary,
    textAlign: 'center',
    marginTop: 32,
  },
  centerBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, width: '100%' },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  cardHidden: { backgroundColor: colors.inputBg },
  cardEmoji: { fontSize: 34 },
  cardText: { flex: 1 },
  cardName: { fontFamily: fonts.bold, fontSize: 17, color: colors.textPrimary },
  cardDesc: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted, marginTop: 2 },

  countEmoji: { fontSize: 56 },
  countName: { fontFamily: fonts.bold, fontSize: 24, color: colors.textPrimary },
  countDesc: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  countNumber: { fontFamily: fonts.heading, fontSize: 96, color: colors.primary, marginTop: 8 },
  countLimit: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary },

  list: { marginTop: 24, gap: 8 },
  waiting: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  rowMine: { borderWidth: 2, borderColor: colors.primary },
  rank: { fontFamily: fonts.heading, fontSize: 18, color: colors.primary, minWidth: 24 },
  nickname: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: colors.textPrimary },
  raw: { fontFamily: fonts.heading, fontSize: 18, color: colors.textPrimary },
  next: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 'auto',
  },
})
