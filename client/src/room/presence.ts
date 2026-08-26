import { supabase } from '../lib/supabase'

export interface PresenceMeta {
  playerId: string
  nickname: string
}

/**
 * 이 방에 "지금 접속 중"임을 알리는 Presence 채널 (mdfile/집가_설계정리.md §3.3,
 * 프론트엔드_화면명세.md S1 "입장하는 사람이 실시간으로 카운트되는 표시").
 *
 * players 테이블(left_at)은 "방 소속 여부"의 근거이고 TTL로 산다 — 폰이 절전에
 * 들어가 Presence가 끊겨도 방은 안 사라진다(화면명세 §7 엣지 케이스). 이 채널은 그
 * 위에 얹는 "지금 화면을 보고 있나"만 담당하는 부가 정보다.
 *
 * 재연결(절전 복귀 등)돼도 다시 알리도록, track은 매 SUBSCRIBED 콜백마다 부른다 —
 * 한 번만 부르면 소켓이 끊겼다 재연결됐을 때 이 기기가 다시 "접속 중"으로 안 잡힌다.
 */
export function joinRoomPresence(
  roomId: string,
  meta: PresenceMeta,
  onChange: (onlinePlayerIds: Set<string>) => void,
): () => void {
  const channel = supabase.channel(`room-presence:${roomId}`, {
    config: { presence: { key: meta.playerId } },
  })

  const emit = () => {
    const state = channel.presenceState<PresenceMeta>()
    const ids = new Set<string>()
    for (const presences of Object.values(state)) {
      for (const p of presences) ids.add(p.playerId)
    }
    onChange(ids)
  }

  channel
    .on('presence', { event: 'sync' }, emit)
    .on('presence', { event: 'join' }, emit)
    .on('presence', { event: 'leave' }, emit)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') channel.track(meta)
    })

  return () => {
    channel.unsubscribe()
  }
}
