import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet, Text } from 'react-native'
import { COLORS } from '../../theme'

/** 튀어나오는 데 걸리는 시간(ms). 잠금(WRONG_LOCK_MS)보다 훨씬 짧아야 한다. */
export const POP_MS = 120

/**
 * 틀렸다는 표시.
 *
 * 예전에는 버튼이 빨개지는 것과 아래 한 줄 문구가 전부였다. 둘 다 눈이
 * 가 있는 곳(줄 맨 앞 고양이)에서 멀어서, 빠르게 두드리는 중에는 틀린 줄
 * 모르고 지나갔다. 보고 있던 자리에 그대로 띄운다.
 *
 * 커졌다 제자리로 오는 팝. 그냥 나타나면 다음 고양이 그림에 섞여 안 읽힌다.
 */
export function WrongMark() {
  const pop = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(pop, { toValue: 1, duration: POP_MS, useNativeDriver: true }).start()
    return () => pop.stopAnimation()
  }, [pop])

  return (
    <Animated.View
      testID="wrong-mark"
      pointerEvents="none"
      style={[
        styles.mark,
        {
          opacity: pop,
          transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1.7, 1] }) }],
        },
      ]}
    >
      <Text style={styles.glyph}>✕</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // 고양이 줄 위에 그대로 겹친다. 자리를 차지하면 그 순간 줄이 밀린다.
  mark: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    color: COLORS.bad,
    fontSize: 150,
    fontWeight: '900',
    // 어두운 고양이(검정) 위에서도 뜨게 흰 테를 두른다
    textShadowColor: COLORS.surface,
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 0 },
  },
})
