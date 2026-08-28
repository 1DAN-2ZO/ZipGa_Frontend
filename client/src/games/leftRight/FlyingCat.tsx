import React, { useEffect, useRef } from 'react'
import { Animated, StyleSheet } from 'react-native'
import { Cat } from './Cat'
import type { CatColor, Side } from './logic'

/**
 * 날아가는 데 걸리는 시간(ms).
 *
 * 짧아야 한다. 잘하는 사람은 0.6초에 한 마리씩 보내므로, 이보다 길면
 * 앞 고양이가 아직 날아가는 중에 다음 판단을 해야 해서 화면이 시끄러워진다.
 * 판정과 줄 넘김은 누르는 즉시 끝나고 이 연출만 뒤따라간다 — 늦어져도
 * 점수에는 영향이 없다.
 */
export const FLY_MS = 260

/** 날아가는 거리. 고양이 크기 기준이라 화면 폭이 달라져도 비율이 유지된다. */
const DISTANCE_RATIO = 2.2

/**
 * 날아가서 멈추는 가로 위치(px). 왼쪽은 음수, 오른쪽은 양수다.
 *
 * 이 부호가 "누른 쪽으로 간다"는 약속 자체다. 연출 코드 안에 묻어두면
 * 좌우가 뒤집혀도 아무도 모르므로 밖으로 꺼내 검사한다.
 */
export function flyOffsetX(side: Side, size: number): number {
  return (side === 'left' ? -1 : 1) * size * DISTANCE_RATIO
}

/** 날아가면서 도는 각도. 가는 쪽으로 기울어야 던져진 것처럼 보인다. */
export function flyRotation(side: Side): string {
  return `${side === 'left' ? -35 : 35}deg`
}

interface FlyingCatProps {
  color: CatColor
  /** 날아갈 방향. 맞았는지 틀렸는지가 아니라 "누른 쪽"이다. */
  side: Side
  size: number
  onDone: () => void
}

/**
 * 방금 보낸 고양이 한 마리.
 *
 * 대기줄 맨 앞자리에 겹쳐 놓고 누른 쪽으로 던진다. 줄은 이미 다음
 * 고양이로 넘어가 있고 이 그림은 그 위를 지나갈 뿐이라, 연출이 끊겨도
 * 게임 진행은 멀쩡하다.
 *
 * 살짝 떴다가 떨어지는 포물선에 회전을 얹었다. 직선으로 미끄러지면
 * 던진 게 아니라 화면 밖으로 밀려난 것처럼 보인다.
 */
export function FlyingCat({ color, side, size, onDone }: FlyingCatProps) {
  const progress = useRef(new Animated.Value(0)).current
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: FLY_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      // 중간에 다음 고양이가 날아가기 시작하면 이 놈은 언마운트된다.
      // 그때는 finished가 false라 남의 연출을 지우지 않는다.
      if (finished) onDoneRef.current()
    })
    return () => progress.stopAnimation()
  }, [progress])

  return (
    <Animated.View
      testID="flying-cat"
      pointerEvents="none"
      style={[
        styles.flyer,
        { width: size, height: size, marginLeft: -size / 2 },
        {
          opacity: progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] }),
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, flyOffsetX(side, size)],
              }),
            },
            {
              translateY: progress.interpolate({
                inputRange: [0, 0.45, 1],
                outputRange: [0, -size * 0.28, size * 0.12],
              }),
            },
            {
              rotate: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', flyRotation(side)],
              }),
            },
            { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.72] }) },
          ],
        },
      ]}
    >
      <Cat color={color} size={size} front testID="flying-cat-fur" />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  // 대기줄 맨 앞 칸과 같은 자리에 겹친다(Queue.tsx의 slot과 같은 규칙).
  flyer: { position: 'absolute', left: '50%', bottom: 0 },
})
