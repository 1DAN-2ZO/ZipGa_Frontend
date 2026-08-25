import React from 'react'
import { StyleSheet } from 'react-native'
import Svg, { G, Rect } from 'react-native-svg'
import { COLORS } from '../../theme'

/** 좌표계. 화면 비율과 무관하게 이 정사각형을 늘려 채운다. */
const BOX = 200

/** 줄 하나의 폭과 간격. 줄과 바탕이 반씩 나온다. */
const STRIPE_WIDTH = 13

/** 기울기(도). 수직이면 대기줄과 나란해서 눈이 어지럽다. */
const TILT = -22

/**
 * 비스듬히 흐르는 줄무늬 배경.
 *
 * 배경이 밝은 회색 단색이면 고양이 줄이 허공에 뜬 것처럼 보인다.
 * 바탕색보다 아주 조금만 밝게 둔다 — 여기가 튀면 정작 봐야 할 고양이 색이 안 보인다.
 *
 * 가운데에서 퍼지는 방사형은 쓰지 않는다. 욱일기로 읽힌다.
 */
export function Backdrop() {
  // 기울여도 화면 모서리가 비지 않도록 넉넉히 넘겨 그린다.
  const overscan = BOX
  const count = Math.ceil((BOX + overscan * 2) / (STRIPE_WIDTH * 2))

  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox={`0 0 ${BOX} ${BOX}`}
      preserveAspectRatio="xMidYMid slice"
      pointerEvents="none"
    >
      {/* rotation/origin prop은 웹에서 transform-origin으로 새어 나가 경고를 낸다.
          표준 SVG transform 문자열로 돌린다. */}
      <G transform={`rotate(${TILT} ${BOX / 2} ${BOX / 2})`}>
        {Array.from({ length: count }, (_, i) => (
          <Rect
            key={i}
            x={-overscan + i * STRIPE_WIDTH * 2}
            y={-overscan}
            width={STRIPE_WIDTH}
            height={BOX + overscan * 2}
            fill={COLORS.surface}
            opacity={0.5}
          />
        ))}
      </G>
    </Svg>
  )
}
