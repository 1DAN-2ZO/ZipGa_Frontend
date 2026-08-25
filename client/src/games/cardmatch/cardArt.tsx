/**
 * 카드 뒤집기 — 카드 그림.
 *
 * 판마다 세트가 통째로 바뀐다. 새 판이 시작됐다는 걸 한눈에 알리기 위해서다.
 * (판이 바로 이어지면 방금 외운 배치와 새 배치가 섞여서 헷갈린다는 테스트 피드백 반영)
 *
 * 세트 개수는 logic.ts 의 SET_COUNT 와 반드시 같아야 한다.
 * logic.ts 는 react-native-svg 를 import 하지 않아야 순수 로직 테스트가 가볍게 돌아가므로
 * 숫자를 그쪽에 두고, 여기서는 테스트로 일치를 강제한다.
 */
import React from 'react';
import Svg, { Path, Circle, Rect, Ellipse, G } from 'react-native-svg';

export interface IconProps {
  size: number;
}

export type Icon = React.ComponentType<IconProps>;

export interface CardSet {
  name: string;
  icons: Icon[];
}

const VB = '0 0 64 64';

function Frame({ size, children }: IconProps & { children: React.ReactNode }) {
  return (
    <Svg width={size} height={size} viewBox={VB}>
      {children}
    </Svg>
  );
}

function petals(n: number, fill: string, rx: number, ry: number, cy: number, key: string) {
  return Array.from({ length: n }, (_, i) => (
    <G key={key + i} rotation={(360 / n) * i} origin="32, 32">
      <Ellipse cx={32} cy={cy} rx={rx} ry={ry} fill={fill} />
    </G>
  ));
}

/* ===== 세트 1 · 도형 ===== */

const ShCircle: Icon = ({ size }) => (
  <Frame size={size}>
    <Circle cx={32} cy={32} r={23} fill="#E8674A" />
    <Circle cx={32} cy={32} r={10} fill="#FCDCD2" />
  </Frame>
);

const ShTriangle: Icon = ({ size }) => (
  <Frame size={size}>
    <Path d="M32 8 L56 52 H8 Z" fill="#F0B44C" />
    <Path d="M32 27 L43 47 H21 Z" fill="#FDF0D6" />
  </Frame>
);

const ShSquare: Icon = ({ size }) => (
  <Frame size={size}>
    <Rect x={10} y={10} width={44} height={44} rx={9} fill="#3FA063" />
    <Rect x={24} y={24} width={16} height={16} rx={4} fill="#D6F2E1" />
  </Frame>
);

const ShDiamond: Icon = ({ size }) => (
  <Frame size={size}>
    <Path d="M32 6 L58 32 L32 58 L6 32 Z" fill="#3BA5B5" />
    <Path d="M32 21 L43 32 L32 43 L21 32 Z" fill="#D5F0F5" />
  </Frame>
);

const ShHex: Icon = ({ size }) => (
  <Frame size={size}>
    <Path d="M32 5 L55 18.5 V45.5 L32 59 L9 45.5 V18.5 Z" fill="#8B7BD8" />
    <Circle cx={32} cy={32} r={9.5} fill="#E6E1F8" />
  </Frame>
);

const ShStar: Icon = ({ size }) => (
  <Frame size={size}>
    <Path d="M32 4 L40 23 L61 25 L45 38.5 L50 59 L32 48 L14 59 L19 38.5 L3 25 L24 23 Z" fill="#E8699B" />
  </Frame>
);

/* ===== 세트 2 · 화투 ===== */

const HwMae: Icon = ({ size }) => (
  <Frame size={size}>
    <G fill="#E24B5F">
      <Circle cx={32} cy={14} r={10.5} />
      <Circle cx={50} cy={27} r={10.5} />
      <Circle cx={43} cy={48} r={10.5} />
      <Circle cx={21} cy={48} r={10.5} />
      <Circle cx={14} cy={27} r={10.5} />
    </G>
    <Circle cx={32} cy={32} r={7} fill="#F5C563" />
  </Frame>
);

const HwBird: Icon = ({ size }) => (
  <Frame size={size}>
    <Path d="M3 50 Q16 8 32 33 Q48 8 61 50 Q46 26 32 48 Q18 26 3 50 Z" fill="#6E9BD4" />
    <Circle cx={32} cy={39} r={4} fill="#C6DCF2" />
  </Frame>
);

const HwRibbon: Icon = ({ size }) => (
  <Frame size={size}>
    <Path d="M3 20 H61 L51 32 L61 44 H3 L13 32 Z" fill="#D93A4E" />
    <Rect x={17} y={29} width={30} height={6} rx={3} fill="#F7DDA0" />
  </Frame>
);

const HwGuk: Icon = ({ size }) => (
  <Frame size={size}>
    {petals(8, '#F0B44C', 6, 13, 15, 'a')}
    {petals(8, '#F8D48E', 4.5, 9, 20, 'b')}
    <Circle cx={32} cy={32} r={6} fill="#FDEDCB" />
  </Frame>
);

const HwBamboo: Icon = ({ size }) => (
  <Frame size={size}>
    <Rect x={24} y={4} width={16} height={56} rx={5} fill="#2E8B57" />
    <Rect x={21} y={20} width={22} height={5} rx={2.5} fill="#1C6B41" />
    <Rect x={21} y={40} width={22} height={5} rx={2.5} fill="#1C6B41" />
    <Path d="M40 14 Q60 6 62 21 Q46 27 40 14 Z" fill="#57C085" />
    <Path d="M24 34 Q4 26 2 41 Q18 47 24 34 Z" fill="#57C085" />
  </Frame>
);

const HwMoon: Icon = ({ size }) => (
  <Frame size={size}>
    <Circle cx={35} cy={33} r={20} fill="#F5C563" />
    <Circle cx={28} cy={27} r={4.5} fill="#E0AE4E" />
    <Circle cx={41} cy={39} r={3} fill="#E0AE4E" />
    <Circle cx={37} cy={22} r={2.2} fill="#E0AE4E" />
    <Path d="M10 8 l2.4 5.4 5.4 2.4 -5.4 2.4 -2.4 5.4 -2.4 -5.4 -5.4 -2.4 5.4 -2.4 Z" fill="#F5C563" />
    <Path d="M11 44 l1.8 4 4 1.8 -4 1.8 -1.8 4 -1.8 -4 -4 -1.8 4 -1.8 Z" fill="#F5C563" />
  </Frame>
);

/* ===== 세트 3 · 보석 ===== */

const GemDia: Icon = ({ size }) => (
  <Frame size={size}>
    <Path d="M32 5 L56 26 L32 59 L8 26 Z" fill="#4FBFE0" />
    <Path d="M32 5 L56 26 H8 Z" fill="#96DEF2" />
    <Path d="M32 5 L43 26 H21 Z" fill="#DAF3FB" />
  </Frame>
);

const GemEmerald: Icon = ({ size }) => (
  <Frame size={size}>
    <Path d="M20 7 H44 L57 20 V44 L44 57 H20 L7 44 V20 Z" fill="#3FA063" />
    <Path d="M20 7 H44 L57 20 H7 Z" fill="#6DCB90" />
    <Path d="M18 20 H46 V44 H18 Z" fill="#B2E8C7" opacity={0.5} />
  </Frame>
);

const GemRound: Icon = ({ size }) => (
  <Frame size={size}>
    <Circle cx={32} cy={32} r={25} fill="#F0B44C" />
    <Path d="M32 7 A25 25 0 0 1 57 32 H7 A25 25 0 0 1 32 7 Z" fill="#F8D48E" />
    <Circle cx={32} cy={32} r={10} fill="#FDEDCB" />
  </Frame>
);

const GemHeart: Icon = ({ size }) => (
  <Frame size={size}>
    <Path d="M32 58 C9 41 6 26 15 17 C23 9 32 15 32 24 C32 15 41 9 49 17 C58 26 55 41 32 58 Z" fill="#E8536E" />
    <Path d="M32 24 C32 15 41 9 49 17 C53 21 53 28 50 35 Z" fill="#F59AA8" />
  </Frame>
);

const GemPear: Icon = ({ size }) => (
  <Frame size={size}>
    <Path d="M32 4 C45 21 51 32 51 40 A19 19 0 0 1 13 40 C13 32 19 21 32 4 Z" fill="#8B7BD8" />
    <Path d="M32 4 C45 21 51 32 51 40 H32 Z" fill="#B7ACEA" />
  </Frame>
);

const GemTrillion: Icon = ({ size }) => (
  <Frame size={size}>
    <Path d="M32 6 L57 46 Q59 52 52 52 H12 Q5 52 7 46 Z" fill="#E8699B" />
    <Path d="M32 6 L45 27 H19 Z" fill="#F5B9D1" />
    <Path d="M19 27 H45 L52 39 H12 Z" fill="#EE93BC" />
  </Frame>
);

export const SETS: readonly CardSet[] = [
  { name: '도형', icons: [ShCircle, ShTriangle, ShSquare, ShDiamond, ShHex, ShStar] },
  { name: '화투', icons: [HwMae, HwBird, HwRibbon, HwGuk, HwBamboo, HwMoon] },
  { name: '보석', icons: [GemDia, GemEmerald, GemRound, GemHeart, GemPear, GemTrillion] },
];
