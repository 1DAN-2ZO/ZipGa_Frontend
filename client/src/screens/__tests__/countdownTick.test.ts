import { COUNTDOWN_TICK_FROM, shouldTick } from '../Countdown'

/**
 * 카운트다운 화면은 100ms마다 도는데 소리는 초가 바뀔 때만 나야 한다.
 * 이 판단만 떼어내서 검사한다 — 화면을 띄우지 않고도 규칙이 고정된다.
 */
describe('shouldTick', () => {
  it('3·2·1에서 초가 바뀌면 소리를 낸다', () => {
    expect(shouldTick(3, null)).toBe(true)
    expect(shouldTick(2, 3)).toBe(true)
    expect(shouldTick(1, 2)).toBe(true)
  })

  it('같은 초 안에서는 한 번만 낸다', () => {
    // 100ms 간격으로 열 번 도는 동안 초는 그대로다
    expect(shouldTick(3, 3)).toBe(false)
    expect(shouldTick(1, 1)).toBe(false)
  })

  it('3초보다 많이 남았으면 아직 안 낸다', () => {
    // 1판째는 5초에서 시작한다. 5·4에서 울리면 3·2·1이 아니게 된다.
    expect(shouldTick(5, null)).toBe(false)
    expect(shouldTick(COUNTDOWN_TICK_FROM + 1, null)).toBe(false)
  })

  it('0 이하는 시작 순간이므로 틱이 아니다', () => {
    // 이 순간은 App이 go()를 낸다. 여기서 또 내면 두 소리가 겹친다.
    expect(shouldTick(0, 1)).toBe(false)
    expect(shouldTick(-23, 1)).toBe(false)
  })
})
