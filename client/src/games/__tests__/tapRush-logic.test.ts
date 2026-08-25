import { isComplete, normalize, TARGET_TAPS } from '../tapRush/logic'

describe('상수', () => {
  it('목표는 150회다', () => {
    expect(TARGET_TAPS).toBe(150)
  })
})

describe('normalize', () => {
  it('목표를 채우면 100이다', () => {
    expect(normalize(TARGET_TAPS)).toBe(100)
  })

  it('한 번도 안 누르면 0이다', () => {
    expect(normalize(0)).toBe(0)
  })

  it('절반이면 50이다', () => {
    expect(normalize(TARGET_TAPS / 2)).toBe(50)
  })

  it('목표를 넘겨도 100을 넘지 않는다', () => {
    expect(normalize(TARGET_TAPS + 50)).toBe(100)
  })

  it('음수는 0으로 자른다', () => {
    expect(normalize(-10)).toBe(0)
  })

  it('기준선 40점을 넘으려면 전체의 40%가 필요하다', () => {
    const needed = Math.ceil(TARGET_TAPS * 0.4)
    expect(normalize(needed - 1)).toBeLessThan(40)
    expect(normalize(needed)).toBeGreaterThanOrEqual(40)
  })
})

describe('isComplete', () => {
  it('목표에 도달하면 완주다', () => {
    expect(isComplete(TARGET_TAPS)).toBe(true)
  })

  it('목표를 넘겨도 완주다', () => {
    expect(isComplete(TARGET_TAPS + 1)).toBe(true)
  })

  it('하나 모자라면 완주가 아니다', () => {
    expect(isComplete(TARGET_TAPS - 1)).toBe(false)
  })

  it('0회는 완주가 아니다', () => {
    expect(isComplete(0)).toBe(false)
  })
})
