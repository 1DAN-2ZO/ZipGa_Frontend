import React from 'react'
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Path,
  Polygon,
  RadialGradient,
  Stop,
} from 'react-native-svg'
import { COLORS } from '../../theme'
import { CRACK_STAGES } from './logic'

/** 그림을 그리는 좌표계. 실제 화면 크기와 무관하게 이 안에서 계산한다. */
const W = 200
const H = 260

/**
 * 음영.
 *
 * 테마에 올리지 않는다 — 새 색이 아니라 껍데기색·병아리색을 밝게·어둡게 민
 * 것이라, 팔레트에 이름을 붙이면 다른 화면이 실수로 가져다 쓸 수 있다.
 */
const SHELL_HI = '#FFFDF7'
const SHELL_LO = '#EBDCBF'
const CHICK_HI = '#FFEFA8'
const CHICK_LO = '#F0BE2A'

/** 위가 좁고 아래가 넓은 달걀꼴. 가로세로비 148:218 ≈ 0.68. */
const OUTLINE =
  'M100,26 C66,26 26,96 26,158 C26,212 59,244 100,244 C141,244 174,212 174,158 C174,96 134,26 100,26 Z'

/** 부화한 뒤 남는 아래 껍데기. 깨진 단면이 위를 향한다. */
const BOWL =
  'M30,178 L48,162 L64,180 L82,161 L100,180 L118,162 L136,180 L154,163 L170,178' +
  ' C170,220 140,244 100,244 C60,244 30,220 30,178 Z'

/** 머리에 얹히는 껍데기 조각. 갓 나온 티가 이것 하나로 난다. */
const CAP =
  'M66,64 C66,32 82,18 104,18 C126,18 142,32 142,64' +
  ' L131,52 L120,66 L108,50 L97,66 L86,51 L76,65 Z'

/**
 * 금이 번지는 순서.
 *
 * 흩어진 조각이 아니라 **하나의 금이 자라는** 모양이다. 각 단계는 앞 단계가
 * 끝난 점에서 시작하고, 네 번째와 여섯 번째는 중간에서 옆으로 갈라진다.
 * 따로 떨어진 자국을 늘리면 금이 아니라 낙서로 보인다.
 *
 * 무작위로 뽑지 않고 고정한 이유는, 같은 타수면 누구 화면에서나 같은 그림이어야
 * 서로 보고 "몇 개 남았나"를 알 수 있기 때문이다.
 */
const CRACKS: readonly string[] = [
  'M100,50 L110,60 L95,67 L105,79',
  'M105,79 L90,86 L103,95 L88,105',
  'M88,105 L102,114 L86,122 L98,134',
  'M88,105 L68,110 L58,100 L42,108',
  'M98,134 L83,143 L97,153 L82,165',
  'M98,134 L120,139 L131,129 L149,137',
  'M82,165 L96,175 L80,186 L93,200',
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
      <Defs>
        <RadialGradient id="eggShell" cx="34%" cy="26%" r="84%">
          <Stop offset="0%" stopColor={SHELL_HI} />
          <Stop offset="55%" stopColor={COLORS.shell} />
          <Stop offset="100%" stopColor={SHELL_LO} />
        </RadialGradient>
        <RadialGradient id="eggChick" cx="36%" cy="28%" r="82%">
          <Stop offset="0%" stopColor={CHICK_HI} />
          <Stop offset="65%" stopColor={COLORS.chick} />
          <Stop offset="100%" stopColor={CHICK_LO} />
        </RadialGradient>
      </Defs>

      {/* 바닥 그림자. 이게 없으면 그림이 공중에 뜬 스티커로 보인다. */}
      <Ellipse cx={100} cy={249} rx={54} ry={8} fill="#000" opacity={0.08} />

      {hatched ? <Chick /> : <CrackedEgg stage={stage} />}
    </Svg>
  )
}

function CrackedEgg({ stage }: { stage: number }) {
  return (
    <G testID="egg-intact">
      <Path d={OUTLINE} fill="url(#eggShell)" stroke={COLORS.shellLine} strokeWidth={3} />
      <Ellipse
        cx={72}
        cy={94}
        rx={17}
        ry={27}
        fill="#FFFFFF"
        opacity={0.6}
        rotation={-20}
        originX={72}
        originY={94}
      />
      {CRACKS.slice(0, stage).map((d, i) => (
        <Path
          key={d}
          testID={`crack-${i}`}
          d={d}
          fill="none"
          stroke={COLORS.shellCrack}
          strokeWidth={5}
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
      {/* 날개 → 몸 → 머리 순으로 그린다. 뒤엣것이 앞엣것에 덮여야 겹쳐 보인다. */}
      <Ellipse
        cx={46}
        cy={154}
        rx={17}
        ry={27}
        fill={COLORS.chickWing}
        rotation={20}
        originX={46}
        originY={154}
      />
      <Ellipse
        cx={154}
        cy={154}
        rx={17}
        ry={27}
        fill={COLORS.chickWing}
        rotation={-20}
        originX={154}
        originY={154}
      />
      <Ellipse cx={100} cy={158} rx={52} ry={48} fill="url(#eggChick)" />
      <Circle cx={100} cy={96} r={44} fill="url(#eggChick)" />

      <Ellipse
        cx={79}
        cy={79}
        rx={13}
        ry={18}
        fill="#FFFFFF"
        opacity={0.38}
        rotation={-20}
        originX={79}
        originY={79}
      />
      <Circle cx={83} cy={96} r={6.5} fill={COLORS.text} />
      <Circle cx={117} cy={96} r={6.5} fill={COLORS.text} />
      {/* 눈동자에 점 하나. 이게 있고 없고로 살아 있는지가 갈린다. */}
      <Circle cx={85.5} cy={93.5} r={2.2} fill="#FFFFFF" />
      <Circle cx={119.5} cy={93.5} r={2.2} fill="#FFFFFF" />
      <Ellipse cx={65} cy={112} rx={9} ry={5.5} fill={COLORS.blush} opacity={0.8} />
      <Ellipse cx={135} cy={112} rx={9} ry={5.5} fill={COLORS.blush} opacity={0.8} />
      <Polygon points="100,106 112,114 100,122 88,114" fill={COLORS.beak} />

      {/* 몸을 반쯤 가리는 아래 껍데기. 병아리보다 나중에 그려야 그 안에 앉아 보인다. */}
      <Path d={BOWL} fill="url(#eggShell)" stroke={COLORS.shellLine} strokeWidth={3} />

      <G rotation={18} originX={104} originY={58}>
        <Path d={CAP} fill="url(#eggShell)" stroke={COLORS.shellLine} strokeWidth={3} />
      </G>
    </G>
  )
}
