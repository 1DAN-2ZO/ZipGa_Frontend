import {
  CRACK_STAGES,
  crackStage,
  isComplete,
  normalize,
  TAPS_PER_CRACK,
  TARGET_TAPS,
} from '../tapRush/logic'

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

describe('crackStage', () => {
  it('아직 20회를 못 채우면 멀쩡한 계란이다', () => {
    expect(crackStage(0)).toBe(0)
    expect(crackStage(TAPS_PER_CRACK - 1)).toBe(0)
  })

  it('20회마다 금이 하나씩 는다', () => {
    expect(crackStage(TAPS_PER_CRACK)).toBe(1)
    expect(crackStage(TAPS_PER_CRACK * 2)).toBe(2)
    expect(crackStage(TAPS_PER_CRACK * 7)).toBe(7)
  })

  it('같은 구간 안에서는 금이 그대로다', () => {
    expect(crackStage(TAPS_PER_CRACK + 1)).toBe(1)
    expect(crackStage(TAPS_PER_CRACK * 2 - 1)).toBe(1)
  })

  it('부화 직전까지 금이 다 차 있다', () => {
    // 마지막 금이 목표 전에 나와야 "다 깨진 계란에서 병아리가 나온다"가 된다.
    expect(crackStage(TARGET_TAPS - 1)).toBe(CRACK_STAGES)
  })

  it('정해진 개수를 넘지 않는다', () => {
    // 그림에 그려둔 금이 CRACK_STAGES개뿐이라 넘으면 그릴 게 없다.
    expect(crackStage(TARGET_TAPS)).toBe(CRACK_STAGES)
    expect(crackStage(TARGET_TAPS * 10)).toBe(CRACK_STAGES)
  })

  it('음수는 0으로 자른다', () => {
    expect(crackStage(-5)).toBe(0)
  })
})

describe('금 개수', () => {
  it('목표를 20으로 나눈 만큼 금이 생긴다', () => {
    expect(CRACK_STAGES).toBe(Math.floor((TARGET_TAPS - 1) / TAPS_PER_CRACK))
    expect(CRACK_STAGES).toBe(7)
  })

  it('금이 다 간 뒤에도 두드릴 게 남아 있다', () => {
    // 마지막 금과 부화가 같은 순간이면 "다 깨졌는데 아직 안 나옴"이 없어져
    // 마지막 10회의 긴장이 사라진다.
    expect(CRACK_STAGES * TAPS_PER_CRACK).toBeLessThan(TARGET_TAPS)
  })
})
