import React from 'react'
import Svg, { Ellipse, G, Path, Rect } from 'react-native-svg'
import { COLORS } from '../../theme'
import type { CatColor } from './logic'

/**
 * 색마다의 털 빛깔.
 *
 * 고양이 이모지는 어떤 색을 뜻하든 늘 주황색이라 "검정 고양이"가 주황색으로 보인다.
 * 색이 유일한 단서인 게임이라 그림을 직접 그려서 이 값으로 칠한다.
 */
export const FUR: Record<CatColor, string> = {
  black: '#2B2B34',
  red: '#F0455C',
  white: '#FFFFFF',
  blue: '#3D82F5',
}

/**
 * 윤곽선.
 *
 * 배경이 밝은 회색이라 흰 고양이는 선이 없으면 배경에 묻는다.
 * 만화처럼 굵고 어두운 선으로 네 색 모두를 똑같이 띄운다.
 */
const OUTLINE = COLORS.text

/**
 * 얼굴 바탕.
 *
 * 어떤 털 색이든 얼굴은 같은 색이라 표정이 늘 잘 보인다.
 * 흰 고양이의 후드와 구분되도록 살짝 크림색을 넣는다 — 완전한 흰색이면
 * 흰 고양이가 얼굴만 있는 덩어리로 보인다.
 */
const FACE = '#FFEEDC'
/** 볼터치 */
const BLUSH = '#FFC2C7'

/** 그림을 그리는 좌표계. size와 무관하게 이 안에서 계산한다. */
const BOX = 100

interface CatProps {
  color: CatColor
  /** 화면에 그려질 한 변의 길이(px) */
  size: number
  /**
   * 앞줄인지.
   *
   * 지금 보낼 놈만 눈썹을 세워 노려본다. 뒷줄은 순한 얼굴이라
   * 어느 놈을 판단해야 하는지가 표정만으로도 갈린다.
   */
  front?: boolean
  /** 색을 확인하는 통로. 테스트가 이 이름으로 털을 찾는다. */
  testID: string
}

/**
 * 색 후드를 뒤집어쓴 고양이 한 마리.
 *
 * 바깥은 털 색, 안쪽은 하얀 얼굴이다. 문지기와 대기줄이 같은 그림이라
 * "같은 색끼리 보낸다"는 규칙이 눈으로 바로 읽힌다.
 */
export function Cat({ color, size, front = false, testID }: CatProps) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`}>
      {/* 후드 — 귀 두 개가 달린 둥근 몸통. 이 한 덩어리가 색을 나른다. */}
      <Path
        testID={testID}
        d="M22 30 L18 8 L38 20 Q50 16 62 20 L82 8 L78 30
           Q92 44 92 62 Q92 92 50 92 Q8 92 8 62 Q8 44 22 30 Z"
        fill={FUR[color]}
        stroke={OUTLINE}
        strokeWidth={4}
        strokeLinejoin="round"
      />

      {/* 하얀 얼굴 */}
      <Ellipse cx={50} cy={58} rx={30} ry={27} fill={FACE} stroke={OUTLINE} strokeWidth={3} />

      {/* 볼터치 */}
      <Ellipse cx={26} cy={62} rx={7} ry={5} fill={BLUSH} />
      <Ellipse cx={74} cy={62} rx={7} ry={5} fill={BLUSH} />

      {front ? (
        // 앞줄 — 눈썹을 세운 얼굴
        <G>
          <Path d="M34 46 L48 53" stroke={OUTLINE} strokeWidth={7} strokeLinecap="round" />
          <Path d="M66 46 L52 53" stroke={OUTLINE} strokeWidth={7} strokeLinecap="round" />
          <Rect x={40} y={68} width={20} height={4} rx={2} fill={OUTLINE} />
        </G>
      ) : (
        // 뒷줄 — 순한 얼굴
        <G>
          <Ellipse cx={39} cy={55} rx={3.5} ry={4.5} fill={OUTLINE} />
          <Ellipse cx={61} cy={55} rx={3.5} ry={4.5} fill={OUTLINE} />
          <Path
            d="M44 68 Q50 73 56 68"
            stroke={OUTLINE}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
        </G>
      )}
    </Svg>
  )
}
