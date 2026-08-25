import {
  computeResult,
  DIFF_COUNT,
  makeScene,
  PHOTOS,
  patchAt,
  PERFECT_COUNT,
  WRONG_LOCK_MS,
} from '../spotDiff/logic'
import { pickGames } from '../registry'

const sceneAt = (seed: number, index: number) => makeScene(seed, index)

describe('PHOTOS', () => {
  it('여러 장이 있어야 판마다 다른 사진이 나온다', () => {
    expect(PHOTOS.length).toBeGreaterThanOrEqual(3)
  })

  it('사진마다 출처를 밝힌다 — 어디서 왔는지 모르면 라이선스를 확인할 수 없다', () => {
    for (const photo of PHOTOS) {
      expect(photo.subject).toBeTruthy()
      expect(photo.unsplashId).toMatch(/^photo-/)
    }
  })

  it('사진 id가 중복되지 않는다', () => {
    expect(new Set(PHOTOS.map((p) => p.id)).size).toBe(PHOTOS.length)
  })

  it('틀렸을 때 1초 잠긴다', () => {
    // 20초짜리 판에서 1초는 큰 벌이다. 찍어서 넘기지 못하게 하는 값이다.
    expect(WRONG_LOCK_MS).toBe(1000)
  })

  it('한 문제를 낼 만큼 고칠 곳이 넉넉하다', () => {
    for (const photo of PHOTOS) {
      expect(photo.patches.length).toBeGreaterThan(DIFF_COUNT)
    }
  })

  it('고칠 곳의 이름이 작품 안에서 중복되지 않는다', () => {
    for (const photo of PHOTOS) {
      const ids = photo.patches.map((p) => p.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('모든 영역이 그림 안에 있다 — 밖으로 나가면 잘려서 안 보인다', () => {
    for (const photo of PHOTOS) {
      for (const patch of photo.patches) {
        expect(patch.rect.x).toBeGreaterThanOrEqual(0)
        expect(patch.rect.y).toBeGreaterThanOrEqual(0)
        expect(patch.rect.x + patch.rect.w).toBeLessThanOrEqual(1)
        expect(patch.rect.y + patch.rect.h).toBeLessThanOrEqual(1)
      }
    }
  })

  it('복제해 올 자리도 그림 안이다', () => {
    for (const photo of PHOTOS) {
      for (const patch of photo.patches) {
        if (patch.kind !== 'clone') continue
        expect(patch.rect.x + patch.dx).toBeGreaterThanOrEqual(0)
        expect(patch.rect.y + patch.dy).toBeGreaterThanOrEqual(0)
        expect(patch.rect.x + patch.dx + patch.rect.w).toBeLessThanOrEqual(1)
        expect(patch.rect.y + patch.dy + patch.rect.h).toBeLessThanOrEqual(1)
      }
    }
  })

  it('복제는 실제로 다른 자리에서 가져온다 — 제자리면 아무것도 안 바뀐다', () => {
    for (const photo of PHOTOS) {
      for (const patch of photo.patches) {
        if (patch.kind !== 'clone') continue
        expect(Math.abs(patch.dx) + Math.abs(patch.dy)).toBeGreaterThan(0)
      }
    }
  })

  it('복제는 조금만 옮긴다 — 멀리서 끌어오면 뭉갠 자국이 남는다', () => {
    // 진짜 방어선은 `npm run check:spotdiff`다. 실제로 고친 사진을 재서
    // 티가 나는지 판정한다. 여기서는 명백히 지나친 값만 막는다.
    for (const photo of PHOTOS) {
      for (const patch of photo.patches) {
        if (patch.kind !== 'clone') continue
        expect(Math.hypot(patch.dx, patch.dy)).toBeLessThan(0.11)
      }
    }
  })

  it('크기를 바꾸는 곳은 실제로 크기가 달라진다', () => {
    for (const photo of PHOTOS) {
      for (const patch of photo.patches) {
        if (patch.kind !== 'scale') continue
        expect(patch.factor).not.toBe(1)
        // 너무 키우면 잘린 티가 나고, 너무 조금이면 아무도 못 찾는다
        expect(patch.factor).toBeGreaterThan(1.05)
        expect(patch.factor).toBeLessThan(1.35)
      }
    }
  })

  it('지우는 방식에 기대지 않는다 — 뭉갠 자국이 곧 정답이 되면 게임이 아니다', () => {
    // 사진 자신의 질감을 재배치하는 방식(뒤집기·키우기·살짝 옮기기)이 주가 되어야 한다
    for (const photo of PHOTOS) {
      const rearranging = photo.patches.filter((p) => p.kind !== 'clone')
      expect(rearranging.length).toBeGreaterThanOrEqual(photo.patches.length / 2)
    }
  })

  it('고친 자리 한가운데를 누르면 반드시 자기 자신이 잡힌다', () => {
    // 영역이 겹치면 맞게 찍고도 옆이 집혀 오답이 된다.
    for (const photo of PHOTOS) {
      for (const patch of photo.patches) {
        const cx = patch.rect.x + patch.rect.w / 2
        const cy = patch.rect.y + patch.rect.h / 2
        expect(patchAt(photo, cx, cy)?.id).toBe(patch.id)
      }
    }
  })
})

describe('makeScene', () => {
  it('같은 시드와 번호는 완전히 같은 문제를 만든다', () => {
    expect(sceneAt(31337, 0)).toEqual(sceneAt(31337, 0))
  })

  it('같은 시드라도 번호가 다르면 다른 문제가 나온다', () => {
    const a = sceneAt(7, 0)
    const b = sceneAt(7, 1)
    expect(a.patchIds).not.toEqual(b.patchIds)
  })

  it('다른 시드는 다른 문제를 만든다', () => {
    expect(sceneAt(1, 0).patchIds).not.toEqual(sceneAt(2, 0).patchIds)
  })

  it('정해진 개수만큼 고친다', () => {
    for (let i = 0; i < 20; i++) {
      expect(sceneAt(99, i).patchIds).toHaveLength(DIFF_COUNT)
    }
  })

  it('같은 곳을 두 번 고르지 않는다', () => {
    for (let i = 0; i < 20; i++) {
      const { patchIds } = sceneAt(321, i)
      expect(new Set(patchIds).size).toBe(DIFF_COUNT)
    }
  })

  it('고른 곳이 전부 그 작품에 있는 것이다', () => {
    for (let i = 0; i < 20; i++) {
      const scene = sceneAt(555, i)
      const ids = scene.photo.patches.map((p) => p.id)
      for (const id of scene.patchIds) {
        expect(ids).toContain(id)
      }
    }
  })

  it('작품을 하나 고른다', () => {
    expect(PHOTOS).toContain(sceneAt(77, 0).photo)
  })
})

describe('사진 순서', () => {
  const orderFor = (seed: number, count: number) =>
    Array.from({ length: count }, (_, i) => sceneAt(seed, i).photo.id)

  it('연달아 같은 사진이 나오지 않는다', () => {
    // 매번 독립적으로 뽑으면 4장 중 4번에 1번은 직전과 겹친다.
    // 20초에 두세 문제뿐이라 한 번만 겹쳐도 "안 바뀌네"가 된다.
    for (const seed of [1, 7, 99, 4242, 31337, 100003, 100005]) {
      const order = orderFor(seed, 12)
      for (let i = 1; i < order.length; i++) {
        expect(order[i]).not.toBe(order[i - 1])
      }
    }
  })

  it('한 바퀴 도는 동안 모든 사진이 한 번씩 나온다', () => {
    for (const seed of [1, 7, 4242]) {
      const round = orderFor(seed, PHOTOS.length)
      expect(new Set(round).size).toBe(PHOTOS.length)
    }
  })

  it('같은 시드는 같은 순서를 만든다 — 여럿이 같은 사진을 봐야 한다', () => {
    expect(orderFor(4242, 8)).toEqual(orderFor(4242, 8))
  })

  it('다른 시드는 다른 순서를 만든다', () => {
    const a = orderFor(1, 8)
    const b = orderFor(2, 8)
    expect(a).not.toEqual(b)
  })

  it('게임 추첨과 사진 순서가 얽히지 않는다', () => {
    // 둘 다 같은 시드로 같은 길이 배열을 섞으면 순열이 똑같아진다.
    // 그러면 이 게임이 뽑히는 시드에서는 늘 같은 사진이 첫 번째로 나온다.
    const firstPhotos = new Set<string>()
    for (let seed = 100000; seed < 102000; seed++) {
      if (pickGames(seed, 1)[0].info.id !== 'spotDiff') continue
      firstPhotos.add(sceneAt(seed, 0).photo.id)
    }
    expect(firstPhotos.size).toBe(PHOTOS.length)
  })
})

describe('patchAt', () => {
  const photo = PHOTOS[0]

  it('영역 안을 누르면 그 영역을 집는다', () => {
    const patch = photo.patches[0]
    const cx = patch.rect.x + patch.rect.w / 2
    const cy = patch.rect.y + patch.rect.h / 2
    expect(patchAt(photo, cx, cy)?.id).toBe(patch.id)
  })

  it('아무 영역도 없는 곳을 누르면 아무것도 안 집는다', () => {
    expect(patchAt(photo, -1, -1)).toBeNull()
  })
})

describe('computeResult', () => {
  const TIME_LIMIT = 20

  it('score는 찾은 개수 그대로다', () => {
    expect(
      computeResult({ foundCount: 3, lastFoundElapsedMs: 9000, timeLimitSec: TIME_LIMIT, finished: true })
        .score,
    ).toBe(3)
  })

  it('하나도 못 찾으면 0점이다', () => {
    expect(
      computeResult({ foundCount: 0, lastFoundElapsedMs: 0, timeLimitSec: TIME_LIMIT, finished: true })
        .normalizedScore,
    ).toBe(0)
  })

  it('기준 개수를 찾으면 100점이다', () => {
    expect(
      computeResult({
        foundCount: PERFECT_COUNT,
        lastFoundElapsedMs: 18000,
        timeLimitSec: TIME_LIMIT,
        finished: true,
      }).normalizedScore,
    ).toBe(100)
  })

  it('기준을 넘겨도 100점을 넘지 않는다', () => {
    expect(
      computeResult({
        foundCount: PERFECT_COUNT + 5,
        lastFoundElapsedMs: 19000,
        timeLimitSec: TIME_LIMIT,
        finished: true,
      }).normalizedScore,
    ).toBe(100)
  })

  it('한 문제를 반만 풀어도 그 하나는 인정한다 (0점 처리 금지)', () => {
    expect(
      computeResult({ foundCount: 1, lastFoundElapsedMs: 3000, timeLimitSec: TIME_LIMIT, finished: true })
        .normalizedScore,
    ).toBeGreaterThan(0)
  })

  it('tiebreakMs는 마지막으로 찾은 시각이다', () => {
    expect(
      computeResult({ foundCount: 2, lastFoundElapsedMs: 7400, timeLimitSec: TIME_LIMIT, finished: true })
        .tiebreakMs,
    ).toBe(7400)
  })

  it('하나도 못 찾으면 tiebreakMs는 제한시간 전체다', () => {
    expect(
      computeResult({ foundCount: 0, lastFoundElapsedMs: 0, timeLimitSec: TIME_LIMIT, finished: true })
        .tiebreakMs,
    ).toBe(TIME_LIMIT * 1000)
  })

  it('중도 이탈은 완주가 아니다', () => {
    expect(
      computeResult({ foundCount: 2, lastFoundElapsedMs: 6000, timeLimitSec: TIME_LIMIT, finished: false })
        .finished,
    ).toBe(false)
  })
})
