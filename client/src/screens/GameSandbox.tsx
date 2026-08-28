import { useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { PillButton } from '../components/PillButton'
import { ScreenHeader } from '../components/ScreenHeader'
import { Watermark } from '../components/Watermark'
import { pickGames } from '../games/registry'
import { PENALTY_THRESHOLD, validateGameResult } from '../games/types'
import type { GameModule, GameResult } from '../games/types'
import { colors, fonts, radius } from '../theme/colors'

type Phase =
  | { name: 'ready' }
  | { name: 'playing'; seed: number; game: GameModule }
  | { name: 'done'; seed: number; game: GameModule; result: GameResult }

/**
 * 시드를 6자리로 뽑는다. 자릿수가 들쭉날쭉하면 옆 사람에게 불러주기 나쁘다.
 */
const drawSeed = () => String(100000 + Math.floor(Math.random() * 900000))

/**
 * 미니게임 확인용 껍데기.
 *
 * 실제 앱에서는 서버가 세션 시드를 내려주고 S5~S8이 3판을 굴리지만,
 * 여기서는 시드를 직접 넣어 "같은 시드 = 같은 문제"가 성립하는지 맞춰본다.
 * 게임 선택도 레지스트리를 거치므로 registry.ts에 등록만 하면 여기에 뜬다.
 */
export function GameSandbox({ onSettings, onGoHome }: { onSettings: () => void; onGoHome: () => void }) {
  const [phase, setPhase] = useState<Phase>({ name: 'ready' })
  const [seedText, setSeedText] = useState(drawSeed)

  const start = () => {
    const parsed = Number(seedText.trim())
    const seed = Number.isFinite(parsed) ? parsed : 0
    const [game] = pickGames(seed, 1)
    setPhase({ name: 'playing', seed, game })
  }

  const handleFinish = (game: GameModule, seed: number) => (result: GameResult) => {
    // 담당자가 여럿이라 범위를 벗어난 값이 올라올 수 있다. 개발 모드에서 즉시 드러낸다.
    if (__DEV__) {
      for (const problem of validateGameResult(result, game.info.id)) {
        console.error(problem)
      }
    }
    setPhase({ name: 'done', seed, game, result })
  }

  if (phase.name === 'playing') {
    return (
      <View style={styles.screen}>
        <Watermark />
        <phase.game.Component
          key={`${phase.game.info.id}-${phase.seed}`}
          seed={phase.seed}
          timeLimitSec={phase.game.info.timeLimitSec}
          onFinish={handleFinish(phase.game, phase.seed)}
        />
      </View>
    )
  }

  if (phase.name === 'done') {
    const penalized = phase.result.normalizedScore < PENALTY_THRESHOLD
    return (
      <View style={styles.screen}>
        <Watermark />
        <ScreenHeader title="결과" onSettings={onSettings} />
        <View style={styles.center}>
          <Text style={styles.label}>잡은 수</Text>
          <Text style={styles.big}>{phase.result.score}</Text>
          <Text style={styles.meta}>
            {`정규화 ${phase.result.normalizedScore.toFixed(1)} · 기준선 ${PENALTY_THRESHOLD}`}
          </Text>
          <Text style={[styles.verdict, penalized && styles.verdictPenalty]}>
            {penalized ? '집 가' : '통과'}
          </Text>
          <Text style={styles.meta}>
            {`${phase.game.info.name} · 시드 ${phase.seed} · ${phase.result.tiebreakMs}ms`}
          </Text>
        </View>
        <PillButton label="다시하기" icon="refresh" onPress={() => setPhase({ name: 'ready' })} />
      </View>
    )
  }

  return (
    <View style={styles.screen}>
      <Watermark />
      <ScreenHeader
        title="미니게임 확인"
        onSettings={onSettings}
        leadingIcon="home"
        onLeadingIconPress={onGoHome}
      />
      <View style={styles.center}>
        <Text style={styles.label}>같이 하는 사람과 같은 시드를 넣으세요</Text>
        <TextInput
          testID="seed-input"
          style={styles.input}
          value={seedText}
          onChangeText={setSeedText}
          keyboardType="number-pad"
          maxLength={6}
        />
        <Text style={styles.link} onPress={() => setSeedText(drawSeed())}>
          시드 새로 뽑기
        </Text>
      </View>
      <PillButton label="시작" icon="play-arrow" onPress={start} />
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  label: { fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  big: { fontFamily: fonts.heading, fontSize: 84, color: colors.primary },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },
  verdict: { fontFamily: fonts.heading, fontSize: 26, color: colors.primary, marginTop: 12 },
  verdictPenalty: { color: colors.danger },
  input: {
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 24,
    minWidth: 180,
    paddingHorizontal: 24,
    paddingVertical: 12,
    textAlign: 'center',
  },
  link: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.primary,
    marginTop: 6,
    textDecorationLine: 'underline',
  },
})
