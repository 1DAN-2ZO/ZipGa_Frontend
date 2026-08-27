import { supabase } from '../lib/supabase'

export interface PresenceMeta {
  playerId: string
  nickname: string
}

export interface RoomPresence {
  onlinePlayerIds: Set<string>
  /** 방장을 제외한 인원의 "게임 시작" 준비 확인. 대기중→준비완료 한 방향뿐이다
   * (LobbyReadyButton 참고) — 그러니 여기 있다는 것 자체가 확정이다. */
  readyPlayerIds: Set<string>
}

export interface PresenceHandle {
  unsubscribe: () => void
  /** 내 준비 상태를 알린다. Presence라서 탭을 닫거나 연결이 끊기면 자동으로 빠진다 —
   * 되돌리는 API는 따로 없다(대기중→준비완료 한 방향, App.tsx 참고). */
  setReady: (ready: boolean) => void
}

/**
 * 이 방에 "지금 접속 중"임을 알리는 Presence 채널 (mdfile/집가_설계정리.md §3.3,
 * 프론트엔드_화면명세.md S1 "입장하는 사람이 실시간으로 카운트되는 표시").
 *
 * players 테이블(left_at)은 "방 소속 여부"의 근거이고 TTL로 산다 — 폰이 절전에
 * 들어가 Presence가 끊겨도 방은 안 사라진다(화면명세 §7 엣지 케이스). 이 채널은 그
 * 위에 얹는 "지금 화면을 보고 있나"·"게임 시작 준비됐나"를 담당하는 부가 정보다.
 * 둘 다 DB에 안 남기고 Presence로만 들고 있는다 — 연결이 끊기면 그대로 사라져야
 * 맞는 값들이라(탭 닫기 = 강퇴와 같은 결) 별도 리셋 로직이 필요 없다.
 *
 * 재연결(절전 복귀 등)돼도 다시 알리도록, track은 매 SUBSCRIBED 콜백마다 부른다 —
 * 한 번만 부르면 소켓이 끊겼다 재연결됐을 때 이 기기가 다시 "접속 중"으로 안 잡힌다.
 */
export function joinRoomPresence(
  roomId: string,
  meta: PresenceMeta,
  onChange: (presence: RoomPresence) => void,
): PresenceHandle {
  const channel = supabase.channel(`room-presence:${roomId}`, {
    config: { presence: { key: meta.playerId } },
  })

  let ready = false

  const emit = () => {
    const state = channel.presenceState<PresenceMeta & { ready: boolean }>()
    const onlinePlayerIds = new Set<string>()
    const readyPlayerIds = new Set<string>()
    for (const presences of Object.values(state)) {
      for (const p of presences) {
        onlinePlayerIds.add(p.playerId)
        if (p.ready) readyPlayerIds.add(p.playerId)
      }
    }
    onChange({ onlinePlayerIds, readyPlayerIds })
  }

  channel
    .on('presence', { event: 'sync' }, emit)
    .on('presence', { event: 'join' }, emit)
    .on('presence', { event: 'leave' }, emit)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') channel.track({ ...meta, ready })
    })

  return {
    unsubscribe: () => {
      channel.unsubscribe()
    },
    setReady: (next: boolean) => {
      ready = next
      channel.track({ ...meta, ready })
    },
  }
}
