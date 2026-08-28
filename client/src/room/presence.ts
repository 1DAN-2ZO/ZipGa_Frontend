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

/**
 * Presence 채널에 실제로 실려 나가는 한 줄.
 *
 * at은 track한 시각이다. 같은 사람 앞으로 접속이 둘 이상 잡히는 순간을
 * 가려내려고 넣는다 (reducePresence 참고).
 */
export interface TrackedPresence extends PresenceMeta {
  ready: boolean
  at: number
}

/**
 * Presence 상태를 화면이 쓰는 두 집합으로 줄인다.
 *
 * 한 사람 앞에 접속이 둘 이상 잡힐 수 있다. 폰이 절전에서 깨거나 소켓이
 * 잠깐 끊겼다 붙으면, 서버가 옛 접속을 아직 안 거둔 채로 새 접속이 먼저
 * 들어온다. 이때 예전에는 "하나라도 ready면 준비완료"로 읽어서, 지난 세션에
 * 준비를 눌렀던 옛 접속이 남아 있는 동안 아무도 누르지 않았는데 준비완료로
 * 보였다 — 방장 화면에서는 시작 버튼까지 열렸다.
 *
 * 그래서 사람마다 **가장 최근 접속 한 줄만** 본다. 접속해 있다는 사실
 * 자체(onlinePlayerIds)는 어느 줄이든 하나만 있으면 참이라 그대로 모은다.
 */
export function reducePresence(
  state: Record<string, TrackedPresence[]>,
): RoomPresence {
  const onlinePlayerIds = new Set<string>()
  const readyPlayerIds = new Set<string>()

  for (const presences of Object.values(state)) {
    let newest: TrackedPresence | null = null
    for (const p of presences) {
      onlinePlayerIds.add(p.playerId)
      // at이 없는 줄(옛 버전이 track한 것)은 가장 오래된 것으로 친다
      if (newest === null || (p.at ?? 0) >= (newest.at ?? 0)) newest = p
    }
    if (newest?.ready) readyPlayerIds.add(newest.playerId)
  }

  return { onlinePlayerIds, readyPlayerIds }
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
    onChange(reducePresence(channel.presenceState<TrackedPresence>()))
  }

  const track = () => channel.track({ ...meta, ready, at: Date.now() })

  channel
    .on('presence', { event: 'sync' }, emit)
    .on('presence', { event: 'join' }, emit)
    .on('presence', { event: 'leave' }, emit)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') track()
    })

  return {
    unsubscribe: () => {
      channel.unsubscribe()
    },
    setReady: (next: boolean) => {
      ready = next
      track()
    },
  }
}
