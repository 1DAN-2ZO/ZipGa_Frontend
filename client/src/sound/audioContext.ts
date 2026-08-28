/**
 * 앱이 공유하는 AudioContext.
 *
 * 효과음(backend.ts)과 배경음(music.ts)이 같은 것을 쓴다. 브라우저는 열 수 있는
 * 컨텍스트 수가 제한돼 있고, 나뉘어 있으면 배경음의 박자와 효과음이 서로 다른
 * 시계를 보게 된다.
 *
 * 브라우저는 사용자 제스처 전에 오디오를 열어주지 않는다. 그래서 생성만 해두고
 * 실제 여는 것은 첫 소리 시점으로 미룬다 — 그 시점이면 사용자가 이미 무언가를
 * 눌렀을 가능성이 높다. 아직 아무것도 안 눌렀다면 resume()이 조용히 실패하고,
 * 다음 소리에서 다시 시도한다.
 */

type Ctor = typeof AudioContext

let ctx: AudioContext | null = null

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null

  const Ctor: Ctor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext
  if (!Ctor) return null

  try {
    ctx ??= new Ctor()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}
