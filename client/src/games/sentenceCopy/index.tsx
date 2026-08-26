import React, { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { COLORS } from '../../theme'
import type { GameModule, GameProps } from '../types'
import { buildSequence, computeResult, isExactMatch } from './logic'
import { SENTENCES } from './sentences'

/**
 * 문장 따라 쓰기.
 *
 * 제시된 문장을 완전히 똑같이 입력하면 1개 카운트하고 다음 문장으로 넘어간다.
 * 제한시간이 끝나면 스스로 종료하고 결과를 반환한다 — 네트워크 코드는 없다(설계 §3.7).
 */
function SentenceCopyGame({ seed, timeLimitSec, onFinish }: GameProps) {
  const sequence = useMemo(() => buildSequence(seed, SENTENCES), [seed])

  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [correctCount, setCorrectCount] = useState(0)
  const [isOver, setIsOver] = useState(false)
  const [isWrong, setIsWrong] = useState(false)

  // 시계는 하나뿐이다. 화면 표시도 종료 판정도 전부 이 deadline에서 나온다.
  // 틱을 세는 방식은 앱이 백그라운드로 갔을 때 타이머가 멈춰 시간이 늘어난다 — 공정성이 깨진다.
  const deadlineRef = useRef(Date.now() + timeLimitSec * 1000)
  const startedAtRef = useRef(Date.now())
  const [timeLeft, setTimeLeft] = useState(timeLimitSec)

  const correctCountRef = useRef(0)
  const lastCorrectElapsedMsRef = useRef(0)
  const finishedRef = useRef(false)
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  /**
   * 정확히 한 번만 호출한다.
   *
   * @param completed 스스로 정상 종료했는지. 시간을 다 채웠거나 문장 풀을 소진하면 true.
   *   중도 이탈(언마운트)만 false다 — 호스트가 강제 종료할 때 쓰는 값과 같은 의미다.
   */
  const finish = (completed: boolean) => {
    if (finishedRef.current) return
    finishedRef.current = true
    onFinishRef.current(
      computeResult({
        correctCount: correctCountRef.current,
        lastCorrectElapsedMs: lastCorrectElapsedMsRef.current,
        timeLimitSec,
        finished: completed,
      }),
    )
  }

  useEffect(() => {
    const tick = () => {
      const remainMs = deadlineRef.current - Date.now()
      setTimeLeft(Math.max(0, Math.ceil(remainMs / 1000)))
      if (remainMs <= 0) {
        setIsOver(true)
        finish(true)
      }
    }
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [])

  // 중도 이탈. 이미 끝났으면 finishedRef가 막는다.
  useEffect(() => () => finish(false), [])

  const currentSentence = sequence[index]

  const handleSubmit = () => {
    if (isOver || finishedRef.current) return

    if (!isExactMatch(input, currentSentence)) {
      setIsWrong(true)
      return
    }

    lastCorrectElapsedMsRef.current = Date.now() - startedAtRef.current
    correctCountRef.current += 1
    setCorrectCount(correctCountRef.current)
    setInput('')
    setIsWrong(false)

    const next = index + 1
    if (next >= sequence.length) {
      // 풀을 다 썼다. 78개짜리 풀에서 20초 안에 도달할 일은 없지만 경로는 열어둔다.
      setIsOver(true)
      finish(true)
    } else {
      setIndex(next)
    }
  }

  const handleChangeText = (text: string) => {
    setInput(text)
    if (isWrong) setIsWrong(false)
  }

  return (
    <View testID="game-root" style={styles.container}>
      <View style={styles.hud}>
        <View style={styles.hudBlock}>
          <Text style={styles.hudLabel}>맞춘 개수</Text>
          <Text testID="correct-count" style={styles.count}>
            {correctCount}
          </Text>
        </View>
        <View style={[styles.hudBlock, styles.hudBlockRight]}>
          <Text style={styles.hudLabel}>남은 시간</Text>
          <Text testID="time-left" style={[styles.timer, timeLeft <= 5 && styles.timerUrgent]}>
            {timeLeft}
          </Text>
        </View>
      </View>

      <View style={styles.stage}>
        <Text style={styles.prompt}>이 문장을 똑같이</Text>
        <Text testID="current-sentence" style={styles.sentence}>
          {currentSentence}
        </Text>
      </View>

      <TextInput
        style={[styles.input, isWrong && styles.inputWrong]}
        value={input}
        onChangeText={handleChangeText}
        onSubmitEditing={handleSubmit}
        placeholder="여기에 똑같이 입력"
        placeholderTextColor={COLORS.textFaint}
        autoFocus
        autoCorrect={false}
        autoCapitalize="none"
        // 한 판에 여러 문장을 연속으로 치는 게임이라 제출할 때마다 키보드가
        // 내려가면 안 된다. 두 속성을 다 주는 이유:
        //   네이티브 — submitBehavior가 blurOnSubmit을 덮어쓴다
        //   웹      — react-native-web은 submitBehavior를 모른다. 레거시
        //             blurOnSubmit만 보고, 단일행 기본값이 true라
        //             Enter 때 hostNode.blur()를 직접 부른다
        submitBehavior="submit"
        blurOnSubmit={false}
        editable={!isOver}
        returnKeyType="send"
      />
      <Text style={styles.hint}>
        {isWrong ? '다시! 한 글자도 틀리면 안 돼' : '띄어쓰기·문장부호까지 똑같이'}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: COLORS.bg },
  hud: { flexDirection: 'row', justifyContent: 'space-between' },
  hudBlock: { alignItems: 'flex-start' },
  hudBlockRight: { alignItems: 'flex-end' },
  hudLabel: { color: COLORS.textMuted, fontSize: 13, marginBottom: 2 },
  count: { color: COLORS.accent, fontSize: 44, fontWeight: '800' },
  timer: { color: COLORS.text, fontSize: 44, fontWeight: '800' },
  timerUrgent: { color: COLORS.bad },
  stage: { flex: 1, justifyContent: 'center' },
  prompt: { color: COLORS.textMuted, fontSize: 14, marginBottom: 10 },
  sentence: { color: COLORS.text, fontSize: 30, fontWeight: '700', lineHeight: 42 },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    color: COLORS.text,
    fontSize: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputWrong: { borderColor: COLORS.bad },
  hint: { color: COLORS.textFaint, fontSize: 13, marginTop: 10, textAlign: 'center' },
})

export const sentenceCopy: GameModule = {
  info: {
    id: 'sentenceCopy',
    name: '문장 따라 쓰기',
    emoji: '⌨️',
    desc: '제한시간 안에 문장을 몇 개나 똑같이 쓸 수 있나',
    timeLimitSec: 20,
  },
  Component: SentenceCopyGame,
}
