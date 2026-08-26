import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { COLORS } from '../../theme'
import type { GameModule, GameProps } from '../types'
import { buildSequence, computeResult, isExactMatch } from './logic'
import { SENTENCES } from './sentences'

/** 이 높이보다 좁으면 축소본으로 간다. 키보드가 올라온 폰의 남는 높이 기준. */
const COMPACT_HEIGHT = 560

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

  /**
   * 키보드가 올라오면 화면이 절반 가까이 줄어든다. 그때도 따라 쓸 문장은
   * 반드시 다 보여야 하므로 주변 요소를 접는다 (아래 compact 스타일).
   *
   * 신호를 둘 다 보는 이유 — 플랫폼마다 알려주는 방식이 다르다.
   *   Android 네이티브 : 창이 resize된다 → 높이로 잡힌다
   *   iOS 네이티브     : 키보드가 덮기만 하고 높이는 그대로 → 이벤트로만 잡힌다
   *   웹              : react-native-web의 Keyboard.addListener는 빈 스텁이라
   *                     이벤트가 아예 안 온다 → 높이로만 잡힌다
   */
  const [keyboardUp, setKeyboardUp] = useState(false)
  const [availableHeight, setAvailableHeight] = useState(0)

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardUp(true))
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardUp(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  // 키보드가 올라온 폰은 350~450 남는다. 안 올라온 폰은 700 이상이다.
  const compact = keyboardUp || (availableHeight > 0 && availableHeight < COMPACT_HEIGHT)

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
    <KeyboardAvoidingView
      testID="game-root"
      style={styles.container}
      /*
        iOS만 'padding'인 이유: iOS는 키보드가 화면을 덮기만 해서 그대로 두면
        입력창이 키보드 뒤로 숨는다. Android는 창 자체가 resize되므로(기본
        softwareKeyboardLayoutMode) 여기서 또 밀면 두 번 밀린다. 웹은
        react-native-web이 이 컴포넌트를 그냥 View로 렌더한다.
      */
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      onLayout={(e) => setAvailableHeight(e.nativeEvent.layout.height)}
    >
      <View style={styles.hud}>
        <View style={styles.hudBlock}>
          {!compact && <Text style={styles.hudLabel}>맞춘 개수</Text>}
          <Text testID="correct-count" style={[styles.count, compact && styles.countCompact]}>
            {correctCount}
          </Text>
        </View>
        <View style={[styles.hudBlock, styles.hudBlockRight]}>
          {!compact && <Text style={styles.hudLabel}>남은 시간</Text>}
          <Text
            testID="time-left"
            style={[styles.timer, compact && styles.countCompact, timeLeft <= 5 && styles.timerUrgent]}
          >
            {timeLeft}
          </Text>
        </View>
      </View>

      {/*
        ScrollView인 이유: 위에서 아무리 줄여도 긴 문장 + 작은 화면 조합이면
        자리가 모자랄 수 있다. View라면 가운데 정렬 때문에 위아래로 넘쳐서
        문장 윗줄이 잘려 나가는데(읽을 수가 없다), ScrollView면 넘칠 때
        스크롤로 남는다. 자리가 충분하면 flexGrow+center로 그대로 가운데다.
      */}
      <ScrollView
        style={styles.stage}
        contentContainerStyle={styles.stageContent}
        showsVerticalScrollIndicator={false}
        // 문장을 만져도 키보드가 내려가지 않아야 한다
        keyboardShouldPersistTaps="always"
      >
        {!compact && <Text style={styles.prompt}>이 문장을 똑같이</Text>}
        <Text
          testID="current-sentence"
          style={[styles.sentence, compact && styles.sentenceCompact]}
        >
          {currentSentence}
        </Text>
      </ScrollView>

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
      {/* 자리가 급할 때는 틀렸다는 신호만 남긴다. 평소 안내는 접는다 */}
      {(!compact || isWrong) && (
        <Text style={[styles.hint, isWrong && styles.hintWrong]}>
          {isWrong ? '다시! 한 글자도 틀리면 안 돼' : '띄어쓰기·문장부호까지 똑같이'}
        </Text>
      )}
    </KeyboardAvoidingView>
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
  /**
   * minHeight가 있는 이유: flex:1은 자리가 모자라면 0까지 줄어든다.
   * 그러면 따라 쓸 문장이 통째로 사라진다 — 이 게임에서는 문장이
   * 입력창 다음으로 양보할 수 없는 요소다. 축소본 기준 두 줄은 남긴다.
   */
  stage: { flex: 1, minHeight: 72 },
  stageContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 8 },
  prompt: { color: COLORS.textMuted, fontSize: 14, marginBottom: 10 },
  sentence: { color: COLORS.text, fontSize: 30, fontWeight: '700', lineHeight: 42 },
  /** 키보드가 올라온 동안 쓰는 축소본 */
  countCompact: { fontSize: 26 },
  sentenceCompact: { fontSize: 24, lineHeight: 33 },
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
  hintWrong: { color: COLORS.bad, fontWeight: '700' },
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
