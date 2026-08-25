import { createRng } from '../prng'
import type { GameResult } from '../types'

/** 한 문제에서 고쳐지는 곳의 수. */
export const DIFF_COUNT = 3

/**
 * normalizedScore 100의 기준이 되는 "찾은 개수".
 *
 * 털결을 뒤집거나 키운 차이라 한 곳 찾는 데 4초쯤 걸린다.
 * 20초면 다섯 곳이 만점선이다. 화면에는 노출하지 않는다 —
 * 플레이어에게 보이는 건 "지금 몇 개 찾았나"뿐이다.
 */
export const PERFECT_COUNT = 5

/**
 * 오답을 눌렀을 때 잠기는 시간(ms).
 *
 * 없으면 화면을 마구 두드리는 게 눈으로 찾는 것보다 빨라져 게임이 사라진다.
 * 20초짜리 판에서 1초는 큰 벌이라, 찍어서 넘길 생각을 접게 한다.
 */
export const WRONG_LOCK_MS = 1000

/** 사진 안의 사각 영역. 전부 0~1로 정규화한다 — 화면 크기가 달라도 같은 곳을 가리킨다. */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * 사진 한 곳을 고치는 방법.
 *
 * 셋 다 **사진 자신의 픽셀만** 쓴다. 도형을 덧그리거나 멀리서 끌어와 덮으면
 * 뭉갠 자국이 남고, 그 자국이 곧 정답 표시가 되어 게임이 사라진다.
 *
 * - `mirror`: 이 영역을 좌우로 뒤집는다. 털·깃털 무늬가 바뀌지만 질감은 진짜 그대로다
 * - `scale`: 이 영역을 조금 키운다. 눈이 살짝 커지는 식이다
 * - `clone`: 아주 조금(dx, dy) 옮긴다. 수염이나 코가 살짝 밀린다
 */
export type Patch =
  | { id: string; label: string; kind: 'clone'; rect: Rect; dx: number; dy: number }
  | { id: string; label: string; kind: 'mirror'; rect: Rect }
  | { id: string; label: string; kind: 'scale'; rect: Rect; factor: number }

export interface Photo {
  id: string
  /** 무슨 동물인지. 화면에 표시한다. */
  subject: string
  /** Unsplash photo id. 출처를 되짚는 값이다. */
  unsplashId: string
  /** require()로 번들된 이미지 */
  image: number
  /** 가로/세로 비율 */
  aspect: number
  patches: readonly Patch[]
}

/**
 * 쓰는 동물 사진들.
 *
 * 전부 Unsplash License — 상업적 이용 가능, 출처 표기 의무 없음, 수정·배포 허용.
 * 이미지는 빌드 시점에 받아 assets/photos/에 번들한다 — **게임 중 네트워크 통신은 0이다.**
 *
 * 고칠 곳은 사진을 직접 보고 손으로 잡았다. 무작위 영역을 자동으로 고르면
 * 흐린 배경이 걸려 아무도 못 찾거나, 눈을 가로질러 너무 쉬워진다.
 */
export const PHOTOS: readonly Photo[] = [
  {
    id: 'wolf',
    subject: '늑대',
    unsplashId: 'photo-1588167056547-c183313da47c',
    image: require('../../../assets/photos/wolf.jpg'),
    aspect: 4 / 3,
    patches: [
      { id: 'midCenter', label: '한가운데 털결', kind: 'mirror', rect: { x: 0.48, y: 0.56, w: 0.15, h: 0.17 } },  // 점수 67 선명도 55
      { id: 'topCenter', label: '위쪽 가운데 털결', kind: 'mirror', rect: { x: 0.36, y: 0.24, w: 0.15, h: 0.17 } },  // 점수 60 선명도 49
      { id: 'midCenter2', label: '한가운데 털결', kind: 'mirror', rect: { x: 0.32, y: 0.56, w: 0.15, h: 0.17 } },  // 점수 87 선명도 44
      { id: 'midLeft', label: '왼쪽 가운데 털결', kind: 'mirror', rect: { x: 0.16, y: 0.44, w: 0.15, h: 0.17 } },  // 점수 66 선명도 36
      { id: 'topRight', label: '오른쪽 위 털결', kind: 'mirror', rect: { x: 0.56, y: 0.16, w: 0.18, h: 0.2 } },  // 점수 60 선명도 34
    ],
  },
  {
    id: 'owl',
    subject: '흰올빼미',
    unsplashId: 'photo-1500373994708-4d781bd7bd15',
    image: require('../../../assets/photos/owl.jpg'),
    aspect: 4 / 3,
    patches: [
      { id: 'midCenter', label: '한가운데 털결', kind: 'mirror', rect: { x: 0.4, y: 0.52, w: 0.15, h: 0.17 } },  // 점수 67 선명도 44
      { id: 'midLeft', label: '왼쪽 가운데 털결', kind: 'mirror', rect: { x: 0.24, y: 0.48, w: 0.15, h: 0.17 } },  // 점수 66 선명도 30
      { id: 'midRight', label: '오른쪽 가운데 털결', kind: 'mirror', rect: { x: 0.56, y: 0.32, w: 0.15, h: 0.17 } },  // 점수 73 선명도 28
      { id: 'midRight2', label: '오른쪽 가운데 털결', kind: 'mirror', rect: { x: 0.56, y: 0.56, w: 0.15, h: 0.17 } },  // 점수 63 선명도 27
      { id: 'lowLeft', label: '왼쪽 아래 털결', kind: 'mirror', rect: { x: 0.24, y: 0.68, w: 0.15, h: 0.17 } },  // 점수 72 선명도 22
    ],
  },
  {
    id: 'cat',
    subject: '고양이',
    unsplashId: 'photo-1533748539407-cae4ed7f9260',
    image: require('../../../assets/photos/cat.jpg'),
    aspect: 4 / 3,
    patches: [
      { id: 'midCenter', label: '한가운데 털결', kind: 'mirror', rect: { x: 0.36, y: 0.56, w: 0.15, h: 0.17 } },  // 점수 67 선명도 38
      { id: 'lowRight', label: '오른쪽 아래 털결', kind: 'mirror', rect: { x: 0.56, y: 0.6, w: 0.15, h: 0.17 } },  // 점수 71 선명도 33
      { id: 'topCenter', label: '위쪽 가운데 털결', kind: 'mirror', rect: { x: 0.48, y: 0.24, w: 0.18, h: 0.2 } },  // 점수 77 선명도 31
      { id: 'topCenter2', label: '위쪽 가운데 털결', kind: 'mirror', rect: { x: 0.32, y: 0.24, w: 0.15, h: 0.17 } },  // 점수 83 선명도 25
      { id: 'lowLeft', label: '왼쪽 아래 털결', kind: 'mirror', rect: { x: 0.2, y: 0.6, w: 0.15, h: 0.17 } },  // 점수 63 선명도 20
    ],
  },
  {
    id: 'fox',
    subject: '여우',
    unsplashId: 'photo-1516934024742-b461fba47600',
    image: require('../../../assets/photos/fox.jpg'),
    aspect: 4 / 3,
    patches: [
      { id: 'midCenter', label: '한가운데 털결', kind: 'mirror', rect: { x: 0.36, y: 0.48, w: 0.15, h: 0.17 } },  // 점수 64 선명도 43
      { id: 'lowLeft', label: '왼쪽 아래 털결', kind: 'mirror', rect: { x: 0.28, y: 0.68, w: 0.15, h: 0.17 } },  // 점수 72 선명도 34
      { id: 'topLeft', label: '왼쪽 위 털결', kind: 'mirror', rect: { x: 0.2, y: 0.12, w: 0.18, h: 0.2 } },  // 점수 61 선명도 28
      { id: 'lowCenter', label: '아래쪽 가운데 털결', kind: 'mirror', rect: { x: 0.52, y: 0.6, w: 0.15, h: 0.17 } },  // 점수 74 선명도 28
      { id: 'midRight', label: '오른쪽 가운데 털결', kind: 'mirror', rect: { x: 0.56, y: 0.32, w: 0.15, h: 0.17 } },  // 점수 62 선명도 24
    ],
  },
]

/**
 * 사진 순서를 뽑을 때 시드에 섞는 값.
 *
 * 게임 추첨(`registry.pickGames`)과 같은 시드·같은 난수기를 쓰면서 배열 길이까지 같으면
 * 두 순열이 완전히 겹친다. 서로 얽히지 않게 시드를 한 번 비튼다.
 */
const PHOTO_ORDER_SALT = 0x5f356495

export interface Scene {
  photo: Photo
  /** 아래 사진에서 고쳐진 곳들 */
  patchIds: string[]
}

/**
 * 시드와 문제 번호로 문제 하나를 만든다.
 *
 * 어떤 사진에서 어디를 고칠지가 전부 시드에서 나오므로,
 * 같은 시드를 받은 모든 폰이 같은 문제를 같은 순서로 받는다.
 */
export function makeScene(seed: number, sceneIndex: number): Scene {
  // 매번 독립적으로 뽑으면 4장 중 4번에 한 번은 직전과 같은 사진이 걸린다.
  // 20초에 두세 문제뿐이라 한 번만 겹쳐도 "사진이 안 바뀌네"가 된다.
  // 순서를 섞어두고 차례로 돌면 한 바퀴 안에서는 절대 안 겹친다.
  //
  // ⚠️ 시드를 그대로 쓰면 안 된다. registry가 게임을 고를 때도 `createRng(시드).shuffle(...)`을
  // 쓰는데, 게임 수와 사진 수가 같으면 **순열이 완전히 똑같이 나온다.**
  // 그러면 이 게임이 뽑히는 시드에서는 늘 같은 사진이 첫 번째로 걸린다.
  const order = createRng(seed ^ PHOTO_ORDER_SALT).shuffle(PHOTOS)
  const photo = order[sceneIndex % order.length]

  // 고칠 곳은 판마다 따로 뽑는다. 같은 사진이 다시 나와도 다른 곳이 달라진다.
  const rng = createRng(seed + sceneIndex * 7919)
  const patchIds = rng.shuffle(photo.patches.map((p) => p.id)).slice(0, DIFF_COUNT)

  return { photo, patchIds }
}

/**
 * 사진의 (x, y) 지점에 걸린 영역을 찾는다. 좌표는 0~1로 정규화된 값이다.
 *
 * 영역이 겹치면 더 작은 쪽을 집는다 — 큰 영역 안에 작은 영역이 들어 있어도 정확히 집힌다.
 */
export function patchAt(photo: Photo, x: number, y: number): Patch | null {
  let best: Patch | null = null
  let bestArea = Infinity

  for (const patch of photo.patches) {
    const { rect } = patch
    const inside = x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h
    if (!inside) continue

    const area = rect.w * rect.h
    if (area < bestArea) {
      best = patch
      bestArea = area
    }
  }

  return best
}

export interface ComputeResultInput {
  foundCount: number
  lastFoundElapsedMs: number
  timeLimitSec: number
  /** 중도 이탈(언마운트)이면 false. 시간을 다 채웠으면 true. */
  finished: boolean
}

/**
 * 개수형 정규화 (설계 §3.5) — `찾은 수 / 기준 수 × 100`, 0~100으로 clamp.
 *
 * 한 문제를 반만 푼 채 시간이 끝나도 그 하나는 그대로 인정한다.
 * 0점 처리는 계약 위반이다.
 */
export function computeResult({
  foundCount,
  lastFoundElapsedMs,
  timeLimitSec,
  finished,
}: ComputeResultInput): GameResult {
  const normalizedScore = Math.min(100, Math.max(0, (foundCount / PERFECT_COUNT) * 100))

  return {
    normalizedScore,
    score: foundCount,
    // 하나도 못 찾았으면 "가장 느린 사람"으로 둔다. 0으로 두면 꼴찌가 동점 1등이 된다.
    tiebreakMs: foundCount > 0 ? lastFoundElapsedMs : timeLimitSec * 1000,
    finished,
  }
}
