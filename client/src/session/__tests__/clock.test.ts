import { createClock } from '../clock'

function fixedDeps(serverMs: number, localTimes: number[]) {
  let i = 0
  return {
    fetchServerNowMs: async () => serverMs,
    localNowMs: () => localTimes[Math.min(i++, localTimes.length - 1)],
  }
}

describe('createClock', () => {
  it('sync 전에는 보정하지 않는다', () => {
    const clock = createClock(fixedDeps(0, [1000]))
    expect(clock.offsetMs()).toBe(0)
    expect(clock.now()).toBe(1000)
  })

  it('폰 시계가 느리면 앞으로 당긴다', async () => {
    // 로컬 1000에 보냈고 1000에 받았는데 서버는 5000이었다 → 4000 뒤처짐
    const clock = createClock(fixedDeps(5000, [1000, 1000, 1000]))
    await clock.sync()
    expect(clock.offsetMs()).toBe(4000)
    expect(clock.now()).toBe(5000)
  })

  it('폰 시계가 빠르면 뒤로 민다', async () => {
    const clock = createClock(fixedDeps(1000, [5000, 5000, 5000]))
    await clock.sync()
    expect(clock.offsetMs()).toBe(-4000)
    expect(clock.now()).toBe(1000)
  })

  it('왕복 지연을 절반으로 보정한다', async () => {
    // 1000에 보내 1200에 받음 → 서버 응답 시점의 로컬 시각은 1100으로 본다
    const clock = createClock(fixedDeps(5100, [1000, 1200, 1200]))
    await clock.sync()
    expect(clock.offsetMs()).toBe(4000)
  })

  it('sync가 실패해도 이전 보정값을 잃지 않는다', async () => {
    let fail = false
    let i = 0
    const times = [1000, 1000, 1000, 1000, 1000]
    const clock = createClock({
      fetchServerNowMs: async () => {
        if (fail) throw new Error('network')
        return 5000
      },
      localNowMs: () => times[Math.min(i++, times.length - 1)],
    })

    await clock.sync()
    expect(clock.offsetMs()).toBe(4000)

    fail = true
    await expect(clock.sync()).rejects.toThrow('network')
    expect(clock.offsetMs()).toBe(4000)
  })

  it('다시 sync 하면 보정값이 갱신된다', async () => {
    let serverMs = 5000
    let i = 0
    const times = [1000, 1000, 1000, 1000, 1000, 1000]
    const clock = createClock({
      fetchServerNowMs: async () => serverMs,
      localNowMs: () => times[Math.min(i++, times.length - 1)],
    })

    await clock.sync()
    expect(clock.offsetMs()).toBe(4000)

    serverMs = 9000
    await clock.sync()
    expect(clock.offsetMs()).toBe(8000)
  })
})
