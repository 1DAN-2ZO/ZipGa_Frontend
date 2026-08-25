import { createRng, deriveRoundSeeds, mulberry32 } from '../prng'

describe('mulberry32', () => {
  it('같은 시드는 같은 수열을 만든다', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    const seqA = [a(), a(), a(), a(), a()]
    const seqB = [b(), b(), b(), b(), b()]
    expect(seqA).toEqual(seqB)
  })

  it('다른 시드는 다른 수열을 만든다', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()])
  })

  it('0 이상 1 미만을 반환한다', () => {
    const rng = mulberry32(999)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('createRng.int', () => {
  it('같은 시드는 같은 정수 수열을 만든다', () => {
    const a = createRng(777)
    const b = createRng(777)
    expect([a.int(2, 9), a.int(2, 9)]).toEqual([b.int(2, 9), b.int(2, 9)])
  })

  it('min과 max를 포함하는 범위 안에 있다', () => {
    const rng = createRng(42)
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(2, 9)
      expect(v).toBeGreaterThanOrEqual(2)
      expect(v).toBeLessThanOrEqual(9)
      expect(Number.isInteger(v)).toBe(true)
    }
  })

  it('min과 max가 같으면 그 값만 나온다', () => {
    const rng = createRng(5)
    expect(rng.int(7, 7)).toBe(7)
  })
})

describe('createRng.shuffle', () => {
  it('같은 시드는 같은 순서를 만든다', () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    expect(createRng(31).shuffle(items)).toEqual(createRng(31).shuffle(items))
  })

  it('원본 배열을 변경하지 않는다', () => {
    const items = ['a', 'b', 'c']
    createRng(1).shuffle(items)
    expect(items).toEqual(['a', 'b', 'c'])
  })

  it('원소를 잃거나 더하지 않는다', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const shuffled = createRng(88).shuffle(items)
    expect([...shuffled].sort((x, y) => x - y)).toEqual(items)
  })
})

describe('deriveRoundSeeds', () => {
  it('같은 세션 시드는 같은 판 시드들을 만든다', () => {
    expect(deriveRoundSeeds(555, 3)).toEqual(deriveRoundSeeds(555, 3))
  })

  it('요청한 개수만큼 반환한다', () => {
    expect(deriveRoundSeeds(555, 3)).toHaveLength(3)
  })

  it('판마다 서로 다른 시드를 준다', () => {
    const seeds = deriveRoundSeeds(555, 3)
    expect(new Set(seeds).size).toBe(3)
  })

  it('32비트 양의 정수를 반환한다', () => {
    for (const s of deriveRoundSeeds(123, 3)) {
      expect(Number.isInteger(s)).toBe(true)
      expect(s).toBeGreaterThan(0)
      expect(s).toBeLessThanOrEqual(2147483647)
    }
  })
})
