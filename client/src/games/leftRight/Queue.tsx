import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Cat } from './Cat'
import { QUEUE_VISIBLE, type CatColor } from './logic'

/** 맨 앞 고양이 크기(px). 뒤로 갈수록 SHRINK 비율로 줄어든다. */
const FRONT_SIZE = 132
const SHRINK = 0.88

/**
 * 한 칸 뒤로 갈 때 위로 밀리는 거리. 크기에 비례해 겹치는 정도가 일정해진다.
 *
 * 너무 작으면 뒷줄이 후드 꼭대기만 보여서 색을 미리 읽을 수가 없다.
 * 얼굴이 반쯤 드러나는 선이 이 값이다.
 */
const STEP_RATIO = 0.64

export function sizeAt(depth: number): number {
  return FRONT_SIZE * SHRINK ** depth
}

interface QueueProps {
  /** 앞에서부터의 고양이 색. QUEUE_VISIBLE개를 받는다. */
  colors: readonly CatColor[]
}

/**
 * 차례를 기다리는 고양이 줄.
 *
 * 맨 앞이 가장 크고 아래에 있으며, 뒤로 갈수록 작아지고 위로 물러난다.
 * 뒤에 뭐가 오는지 미리 읽히는 게 이 게임의 재미다 — 한 마리만 보이면
 * 판단이 아니라 반응속도 대결이 된다.
 *
 * 겹치는 순서가 중요하다. 뒤쪽부터 그려야 앞 고양이가 위로 올라온다.
 */
export function Queue({ colors }: QueueProps) {
  const visible = colors.slice(0, QUEUE_VISIBLE)

  // 줄 전체가 차지하는 높이. 맨 앞 고양이를 바닥에 붙이려고 미리 잰다.
  const totalHeight =
    sizeAt(0) + visible.slice(1).reduce((sum, _, i) => sum + sizeAt(i + 1) * STEP_RATIO, 0)

  let offset = 0
  const placed = visible.map((color, depth) => {
    const size = sizeAt(depth)
    if (depth > 0) offset += size * STEP_RATIO
    return { color, depth, size, bottom: offset }
  })

  return (
    <View style={[styles.queue, { height: totalHeight }]}>
      {/* 뒤에서부터 그린다. 마지막에 그린 맨 앞 고양이가 제일 위로 올라온다. */}
      {[...placed].reverse().map(({ color, depth, size, bottom }) => (
        <View
          key={depth}
          testID={`queue-slot-${depth}`}
          style={[styles.slot, { width: size, height: size, bottom, marginLeft: -size / 2 }]}
        >
          <Cat color={color} size={size} front={depth === 0} testID={`queue-fur-${depth}`} />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  queue: { width: '100%', justifyContent: 'flex-end' },
  slot: { position: 'absolute', left: '50%' },
})
