import { StatusBar } from 'expo-status-bar'
import React, { useState } from 'react'
import {
  Platform,
  Pressable,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { pickGames } from './src/games/registry'
import { COLORS } from './src/theme'
import { PENALTY_THRESHOLD, validateGameResult } from './src/games/types'
import type { GameModule, GameResult } from './src/games/types'

type Phase =
  | { name: 'ready' }
  | { name: 'playing'; seed: number; game: GameModule }
  | { name: 'done'; seed: number; game: GameModule; result: GameResult }

/**
 * 미니게임 확인용 껍데기 화면.
 *
 * 실제 앱에서는 방/세션이 시드를 내려주고 S5~S8이 3판을 굴리지만(프론트엔드 화면명세 §S5~S8),
 * 여기서는 시드를 직접 입력해 "같은 시드 = 같은 문제"가 실제로 성립하는지 두 폰에서 맞춰본다.
 * 게임 선택도 레지스트리를 거친다 — 게임 담당자가 registry.ts에 한 줄만 추가하면 여기에 뜬다.
 */
/**
 * 판마다 새 시드를 뽑는다. 실제 앱에서는 서버가 세션마다 발급하는 값에 해당한다.
 *
 * 100000~999999로 잡아 항상 6자리다 — 자릿수가 들쭉날쭉하면 옆 사람에게 불러주기 나쁘다.
 */
const drawSeed = () => String(100000 + (Date.now() % 900000))

export default function App() {
  const [phase, setPhase] = useState<Phase>({ name: 'ready' })
  const [seedText, setSeedText] = useState(drawSeed)

  const start = () => {
    const parsed = Number(seedText.trim())
    const seed = Number.isFinite(parsed) ? parsed : 0
    // 실제 세션과 같은 경로로 게임을 고른다. 시드가 같으면 전원이 같은 게임을 받는다.
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

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />

      {phase.name === 'playing' && (
        <phase.game.Component
          key={`${phase.game.info.id}-${phase.seed}`}
          seed={phase.seed}
          timeLimitSec={phase.game.info.timeLimitSec}
          onFinish={handleFinish(phase.game, phase.seed)}
        />
      )}

      {phase.name === 'done' && (
        <View style={styles.centered}>
          <Text style={styles.resultLabel}>맞춘 개수</Text>
          <Text testID="result-count" style={styles.resultCount}>
            {phase.result.score}
          </Text>

          {/* 실제 앱에서는 S7이 원점수만 보여주고 normalizedScore는 숨긴다.
              여기는 계약 확인용이므로 판정에 쓰이는 값을 그대로 노출한다. */}
          <Text testID="result-normalized" style={styles.resultNormalized}>
            {`정규화 ${phase.result.normalizedScore.toFixed(1)} / 기준선 ${PENALTY_THRESHOLD}`}
          </Text>
          <Text
            testID="result-verdict"
            style={[
              styles.resultVerdict,
              phase.result.normalizedScore < PENALTY_THRESHOLD && styles.resultVerdictPenalty,
            ]}
          >
            {phase.result.normalizedScore < PENALTY_THRESHOLD ? '집 가' : '통과'}
          </Text>
          <Text style={styles.resultMeta}>
            {`${phase.game.info.name} · 시드 ${phase.seed} · ${phase.result.tiebreakMs}ms`}
          </Text>

          <Pressable style={styles.button} onPress={() => setPhase({ name: 'ready' })}>
            <Text style={styles.buttonText}>다시하기</Text>
          </Pressable>
        </View>
      )}

      {phase.name === 'ready' && (
        <View style={styles.centered}>
          <Text style={styles.title}>미니게임 확인</Text>
          <Text style={styles.subtitle}>같은 시드 = 같은 문제가 성립하는지 맞춰보는 껍데기</Text>

          <Text style={styles.seedLabel}>같이 하는 사람과 같은 시드를 입력하세요</Text>
          <TextInput
            testID="seed-input"
            style={styles.seedInput}
            value={seedText}
            onChangeText={setSeedText}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="시드"
            placeholderTextColor={COLORS.textFaint}
          />
          <Pressable onPress={() => setSeedText(drawSeed())}>
            <Text style={styles.randomize}>시드 새로 뽑기</Text>
          </Pressable>

          <Pressable style={styles.button} onPress={start}>
            <Text style={styles.buttonText}>시작</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
    // 실제 앱 화면(S0~S11)은 안전영역을 제대로 다루겠지만, 확인용 껍데기에서는 상단만 비켜준다
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 0) : 44,
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },
  title: { color: COLORS.text, fontSize: 32, fontWeight: '800' },
  subtitle: { color: COLORS.textMuted, fontSize: 15, marginTop: 8, marginBottom: 44 },
  seedLabel: { color: COLORS.textMuted, fontSize: 13, marginBottom: 10 },
  seedInput: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '700',
    minWidth: 180,
    paddingHorizontal: 20,
    paddingVertical: 12,
    textAlign: 'center',
  },
  randomize: { color: COLORS.accent, fontSize: 13, marginTop: 12 },
  button: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    marginTop: 36,
    paddingHorizontal: 52,
    paddingVertical: 16,
  },
  buttonText: { color: COLORS.onAccent, fontSize: 18, fontWeight: '800' },
  resultLabel: { color: COLORS.textMuted, fontSize: 15 },
  resultCount: { color: COLORS.accent, fontSize: 96, fontWeight: '800' },
  resultNormalized: { color: COLORS.textMuted, fontSize: 14, marginTop: 4 },
  resultVerdict: { color: COLORS.good, fontSize: 22, fontWeight: '800', marginTop: 14 },
  resultVerdictPenalty: { color: COLORS.bad },
  resultMeta: { color: COLORS.textFaint, fontSize: 13, marginTop: 10 },
})
