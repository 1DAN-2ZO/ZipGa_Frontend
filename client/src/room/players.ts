import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { LobbyPlayer } from '../screens/Lobby'

interface PlayerRow {
  id: string
  nickname: string
  joined_seq: number
}

/**
 * 이 방의 진짜 방장을 서버에서 읽는다.
 *
 * 예전엔 "남은 사람 중 joined_seq 최솟값 = 방장"으로 클라이언트가 자체 추론했는데,
 * 방장 강퇴 시 세션 1등에게 승계하는 규칙(백엔드 _ensure_host 예외 처리, 2026-08-26)이
 * 생기면서 더 이상 입장 순서와 host_player_id가 항상 같지 않다 — 반드시 서버 값을 봐야 한다.
 */
async function fetchHostPlayerId(roomId: string): Promise<string | null> {
  const { data, error } = await supabase.from('rooms').select('host_player_id').eq('id', roomId).single()
  if (error) throw error
  return (data as { host_player_id: string | null }).host_player_id
}

/**
 * 방 참가자 목록.
 *
 * 아직 세션이 한 번도 안 돌았을 수 있으므로 avgScore는 0, rank는 입장 순서로 둔다.
 * 실제 평균 점수·순위는 세션 엔진(P4)이 붙으면 scores 테이블에서 계산해 대체한다.
 */
function toLobbyPlayers(rows: PlayerRow[], hostPlayerId: string | null): LobbyPlayer[] {
  return [...rows]
    .sort((a, b) => a.joined_seq - b.joined_seq)
    .map((row, index) => ({
      id: row.id,
      nickname: row.nickname,
      // host_player_id를 못 읽었을 때만(드묾) 예전 방식(최초 입장자)으로 대체한다
      isHost: hostPlayerId !== null ? row.id === hostPlayerId : index === 0,
      avgScore: 0,
      rank: index + 1,
    }))
}

export async function listPlayers(roomId: string): Promise<LobbyPlayer[]> {
  const [{ data, error }, hostPlayerId] = await Promise.all([
    supabase.from('players').select('id, nickname, joined_seq').eq('room_id', roomId).is('left_at', null),
    fetchHostPlayerId(roomId).catch(() => null),
  ])

  if (error) throw error
  return toLobbyPlayers(data as PlayerRow[], hostPlayerId)
}

/**
 * left_at 여부와 무관하게 전부 읽는다 — 세션 종합 결과를 재구성할 때 쓴다.
 * end_session이 먼저 도착한 한 번만 실행되므로, 벌칙으로 이미 방을 나간
 * 사람의 닉네임도 화면에 표시하려면 이 함수가 필요하다. player_read RLS는
 * "내가 지금 그 방 소속인가"만 보므로, 나간 사람의 행 자체는 여전히 읽힌다.
 */
export async function listAllRoomPlayersEver(roomId: string): Promise<Array<{ id: string; nickname: string }>> {
  const { data, error } = await supabase.from('players').select('id, nickname').eq('room_id', roomId)
  if (error) throw error
  return data as Array<{ id: string; nickname: string }>
}

/**
 * 입장·퇴장이 생기거나(players 변화) 방장이 바뀌면(rooms.host_player_id 변화)
 * 목록을 다시 읽어 콜백으로 넘긴다. 반환값을 호출하면 구독을 해제한다.
 */
export function subscribeToPlayers(roomId: string, onChange: (players: LobbyPlayer[]) => void): () => void {
  const refresh = () => {
    listPlayers(roomId).then(onChange).catch(() => {})
  }

  let channel: RealtimeChannel | null = supabase
    .channel(`room-players:${roomId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, refresh)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, refresh)
    .subscribe()

  return () => {
    channel?.unsubscribe()
    channel = null
  }
}
