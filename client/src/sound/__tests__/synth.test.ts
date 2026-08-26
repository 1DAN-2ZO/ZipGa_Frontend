import { createSynth, type AudioBackend } from '../synth'

/** Web Audio 대신 호출만 기록하는 가짜. 실제 소리는 나지 않는다. */
function fakeBackend() {
  const played: Array<{
    freq: number
    durationMs: number
    volume: number
    atMs: number
    delayMs: number
  }> = []
  let now = 0
  return {
    played,
    advance: (ms: number) => {
      now += ms
    },
    backend: {
      nowMs: () => now,
      tone: (freq: number, durationMs: number, volume: number, delayMs: number) => {
        played.push({ freq, durationMs, volume, atMs: now, delayMs })
      },
    } as AudioBackend,
  }
}

describe('createSynth', () => {
  it('톤을 그대로 백엔드에 넘긴다', () => {
    const { backend, played } = fakeBackend()
    createSynth(backend).tone(440, 100, 0.5)
    expect(played).toEqual([
      { freq: 440, durationMs: 100, volume: 0.5, atMs: 0, delayMs: 0 },
    ])
  })

  it('음 여러 개를 순서대로 낸다', () => {
    const { backend, played } = fakeBackend()
    createSynth(backend).sequence([
      { freq: 440, durationMs: 60 },
      { freq: 660, durationMs: 60 },
    ])
    expect(played.map((p) => p.freq)).toEqual([440, 660])
  })

  it('음마다 지연을 줘서 화음이 아니라 멜로디가 되게 한다', () => {
    const { backend, played } = fakeBackend()
    createSynth(backend).sequence([
      { freq: 440, durationMs: 60 },
      { freq: 660, durationMs: 60 },
      { freq: 880, durationMs: 60 },
    ])
    // 앞 음의 길이 + 간격만큼씩 밀린다
    expect(played.map((p) => p.delayMs)).toEqual([0, 80, 160])
  })

  it('음소거하면 아무 소리도 안 낸다', () => {
    const { backend, played } = fakeBackend()
    const synth = createSynth(backend)
    synth.setEnabled(false)
    synth.tone(440, 100)
    synth.sequence([{ freq: 440, durationMs: 60 }])
    expect(played).toHaveLength(0)
  })

  it('다시 켜면 소리가 난다', () => {
    const { backend, played } = fakeBackend()
    const synth = createSynth(backend)
    synth.setEnabled(false)
    synth.setEnabled(true)
    synth.tone(440, 100)
    expect(played).toHaveLength(1)
  })
})

describe('쿨다운', () => {
  it('쿨다운 안에 겹쳐 부르면 무시한다', () => {
    // 연타 게임이 초당 7번 부른다. 매번 노드를 만들면 부하가 걸린다.
    const { backend, played, advance } = fakeBackend()
    const synth = createSynth(backend)

    synth.tone(440, 30, 0.4, { cooldownMs: 50, key: 'tap' })
    advance(10)
    synth.tone(440, 30, 0.4, { cooldownMs: 50, key: 'tap' })

    expect(played).toHaveLength(1)
  })

  it('쿨다운이 지나면 다시 난다', () => {
    const { backend, played, advance } = fakeBackend()
    const synth = createSynth(backend)

    synth.tone(440, 30, 0.4, { cooldownMs: 50, key: 'tap' })
    advance(60)
    synth.tone(440, 30, 0.4, { cooldownMs: 50, key: 'tap' })

    expect(played).toHaveLength(2)
  })

  it('키가 다르면 서로 막지 않는다', () => {
    const { backend, played } = fakeBackend()
    const synth = createSynth(backend)

    synth.tone(440, 30, 0.4, { cooldownMs: 50, key: 'hit' })
    synth.tone(220, 30, 0.4, { cooldownMs: 50, key: 'miss' })

    expect(played).toHaveLength(2)
  })
})

describe('백엔드가 없을 때', () => {
  it('조용히 아무 일도 안 한다', () => {
    // 테스트 환경과 오디오를 못 여는 브라우저에서 이 경로를 탄다.
    const synth = createSynth(null)
    expect(() => {
      synth.tone(440, 100)
      synth.sequence([{ freq: 440, durationMs: 60 }])
      synth.setEnabled(true)
    }).not.toThrow()
  })
})
