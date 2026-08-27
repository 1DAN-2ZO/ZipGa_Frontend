import React from 'react'
import Svg, { Circle, Ellipse, G, Path, Polygon, Polyline } from 'react-native-svg'
import { COLORS } from '../../theme'
import { CRACK_STAGES } from './logic'

/** 그림을 그리는 좌표계. 실제 화면 크기와 무관하게 이 안에서 계산한다. */
const W = 200
const H = 260

/** 멀쩡한 계란의 윤곽. 아래가 넓고 위가 좁은 진짜 달걀꼴이다. */
const OUTLINE =
  'M100,16 C133,16 162,72 162,136 C162,198 134,246 100,246 C66,246 38,198 38,136 C38,72 67,16 100,16 Z'

/**
 * 금 하나하나의 모양. 위에서 아래로 번져 내려간다.
 *
 * 스무 번에 하나씩 나타나므로 순서가 곧 진행도다. 무작위로 뽑지 않고
 * 고정해 둔 이유는, 같은 타수면 누구 화면에서나 같은 그림이어야
 * "몇 개 남았나"를 서로 보고 알 수 있기 때문이다.
 */
const CRACKS: readonly string[] = [
  '96,50 84,62 98,70 86,82',
  '110,56 124,66 112,76 126,86',
  '70,90 84,98 72,108 86,116',
  '128,102 142,110 130,120 144,128',
  '62,132 78,140 66,150 82,158',
  '118,146 134,154 122,164 138,172',
  '88,180 102,188 90,198 106,206',
]

if (CRACKS.length !== CRACK_STAGES) {
  // 로직과 그림이 어긋나면 마지막 금이 안 그려지거나 남아돈다.
  throw new Error(`금 그림 ${CRACKS.length}개가 단계 ${CRACK_STAGES}개와 다릅니다.`)
}

export interface EggProps {
  /** 0 ~ CRACK_STAGES. 이만큼의 금이 그려진다. */
  stage: number
  /** 부화했는가. true면 계란 대신 병아리가 나온다. */
  hatched: boolean
}

/**
 * 두드릴수록 금이 가고 마지막에 병아리가 나오는 계란.
 *
 * 이미지 파일 대신 벡터로 그린다. 웹 배포에서 용량이 곧 진입 속도이고,
 * 화면 크기가 제각각인 폰에서 어느 해상도로도 깨지지 않는다
 * (효과음을 코드로 합성하는 것과 같은 이유다 — sound/synth.ts).
 */
export function Egg({ stage, hatched }: EggProps) {
  return (
    <Svg testID="egg" width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}>
      {hatched ? <Chick /> : <CrackedEgg stage={stage} />}
    </Svg>
  )
}

function CrackedEgg({ stage }: { stage: number }) {
  return (
    <G testID="egg-intact">
      <Path d={OUTLINE} fill={COLORS.shell} stroke={COLORS.shellLine} strokeWidth={3} />
      {CRACKS.slice(0, stage).map((points, i) => (
        <Polyline
          key={points}
          testID={`crack-${i}`}
          points={points}
          fill="none"
          stroke={COLORS.shellLine}
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </G>
  )
}

function Chick() {
  return (
    <G testID="egg-hatched">
      {/* 병아리를 먼저 그린다. 아래 껍데기가 나중에 덮여야 그 안에 들어앉아 보인다. */}
      <Ellipse cx={100} cy={170} rx={54} ry={50} fill={COLORS.chick} />
      <Circle cx={100} cy={104} r={40} fill={COLORS.chickPale} />
      <Circle cx={86} cy={98} r={5} fill={COLORS.text} />
      <Circle cx={114} cy={98} r={5} fill={COLORS.text} />
      <Polygon points="100,108 118,116 100,124" fill={COLORS.beak} />

      {/* 아래 껍데기. 깨진 단면이 위를 향한다. */}
      <Path
        d={
          'M40,168 L56,152 L72,168 L88,150 L104,168 L120,152 L136,168 L152,154 L160,166' +
          ' C160,212 133,248 100,248 C67,248 40,212 40,168 Z'
        }
        fill={COLORS.shell}
        stroke={COLORS.shellLine}
        strokeWidth={3}
      />

      {/* 머리에 얹힌 껍데기 조각. 갓 나온 티가 이것 하나로 난다. */}
      <G transform="rotate(-18 76 44)">
        <Path
          d="M52,64 C52,38 62,22 76,22 C90,22 100,38 100,64 L92,54 L84,66 L76,52 L66,66 L58,54 Z"
          fill={COLORS.shell}
          stroke={COLORS.shellLine}
          strokeWidth={3}
        />
      </G>
    </G>
  )
}
