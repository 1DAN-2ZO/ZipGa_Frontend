import React, { useId } from 'react'
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Image as SvgImage,
  Mask,
  RadialGradient,
  Stop,
} from 'react-native-svg'
import type { Patch, Photo } from './logic'

/** 사진을 그리는 좌표계. 실제 화면 크기와 무관하게 이 안에서 계산한다. */
const W = 1000

/**
 * 동물 사진 한 장을 그리고, 지정된 곳만 고쳐서 그린다.
 *
 * 사진 위에 도형을 덧그리면 붙여넣은 티가 나므로 **사진 자신의 픽셀만** 쓴다.
 * - clone: 같은 사진을 dx·dy만큼 밀어서 그 영역에만 보이게 한다 → 귀나 눈이 사라진다
 * - mirror: 같은 사진을 영역 한가운데 기준으로 좌우 반전해 그 영역에만 보이게 한다
 *
 * 털결과 색감이 원본 그대로라 고친 자리가 위화감 없이 섞인다.
 */
export function Scene({
  photo,
  patches,
  found,
}: {
  photo: Photo
  /** 이 사진에서 고칠 곳. 원본 쪽은 빈 배열을 넘긴다. */
  patches: readonly Patch[]
  /** 이미 찾아낸 곳 — 동그라미로 표시한다 */
  found: readonly string[]
}) {
  // 한 화면에 사진이 여러 장 뜨므로 clipPath id가 겹치면 안 된다.
  const uid = useId().replace(/:/g, '')
  const H = W / photo.aspect

  const full = (offset?: { x?: number; y?: number }) => (
    <SvgImage
      href={photo.image}
      x={offset?.x ?? 0}
      y={offset?.y ?? 0}
      width={W}
      height={H}
      preserveAspectRatio="xMidYMid slice"
    />
  )

  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} pointerEvents="none">
      <Defs>
        {/*
          가장자리를 부드럽게 푸는 마스크.

          네모로 딱 잘라 붙이면 밝기가 조금만 달라도 경계선이 그대로 드러나
          "사진에 네모를 붙였구나"가 한눈에 보인다. 가운데는 완전히 덮고
          바깥으로 갈수록 투명해지게 해서 이음매를 없앤다.
        */}
        <RadialGradient id={`${uid}-fade`} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#fff" stopOpacity="1" />
          <Stop offset="0.6" stopColor="#fff" stopOpacity="1" />
          <Stop offset="1" stopColor="#fff" stopOpacity="0" />
        </RadialGradient>

        {patches.map((patch) => (
          <Mask key={patch.id} id={`${uid}-${patch.id}`}>
            <Ellipse
              cx={(patch.rect.x + patch.rect.w / 2) * W}
              cy={(patch.rect.y + patch.rect.h / 2) * H}
              rx={(patch.rect.w * W) / 2}
              ry={(patch.rect.h * H) / 2}
              fill={`url(#${uid}-fade)`}
            />
          </Mask>
        ))}
      </Defs>

      {full()}

      {patches.map((patch) => {
        const mask = `url(#${uid}-${patch.id})`
        const cx = (patch.rect.x + patch.rect.w / 2) * W
        const cy = (patch.rect.y + patch.rect.h / 2) * H

        if (patch.kind === 'clone') {
          // dx·dy 떨어진 자리의 사진이 이 영역에 보이도록 이미지를 반대로 민다
          return (
            <G key={patch.id} mask={mask}>
              {full({ x: -patch.dx * W, y: -patch.dy * H })}
            </G>
          )
        }

        if (patch.kind === 'scale') {
          // 영역 한가운데를 붙박아 두고 키운다 — 눈이 조금 커지는 식이다
          const f = patch.factor
          return (
            <G key={patch.id} mask={mask}>
              <G transform={`translate(${cx * (1 - f)} ${cy * (1 - f)}) scale(${f})`}>
                {full()}
              </G>
            </G>
          )
        }

        // 영역 한가운데를 축으로 좌우 반전
        return (
          <G key={patch.id} mask={mask}>
            <G transform={`translate(${2 * cx} 0) scale(-1 1)`}>{full()}</G>
          </G>
        )
      })}

      {/* 찾은 곳은 동그라미로 두른다. 영역을 다 감싸도록 긴 변에 맞춘다. */}
      {photo.patches
        .filter((p) => found.includes(p.id))
        .map((p) => {
          const cx = (p.rect.x + p.rect.w / 2) * W
          const cy = (p.rect.y + p.rect.h / 2) * H
          const r = (Math.max(p.rect.w * W, p.rect.h * H) / 2) * 1.15
          return (
            <React.Fragment key={p.id}>
              <Circle cx={cx} cy={cy} r={r} stroke="#000000" strokeWidth={9} fill="none" opacity={0.35} />
              <Circle cx={cx} cy={cy} r={r} stroke="#22c55e" strokeWidth={5} fill="none" />
            </React.Fragment>
          )
        })}
    </Svg>
  )
}
