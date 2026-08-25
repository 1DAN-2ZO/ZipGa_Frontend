import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { LobbyPlayer } from '../screens/Lobby'

interface PlayerRow {
  id: string
  nickname: string
  joined_seq: number
}

/**
 * 방 참가자 목록. joined_seq가 가장 작은 사람이 방장이다.
 *
 * 아직 세션이 한 번도 안 돌았을 수 있으므로 avgScore는 0, rank는 입장 순서로 둔다.
 * 실제 평균 점수·순위는 세션 엔진(P4)이 붙으면 scores 테이블에서 계산해 대체한다.
 */
function toLobbyPlayers(rows: PlayerRow[]): LobbyPlayer[] {
  return [...rows]
    .sort((a, b) => a.joined_seq - b.joined_seq)
    .map((row, index) => ({
      id: row.id,
      nickname: row.nickname,
      isHost: index === 0,
      avgScore: 0,
      rank: index + 1,
    }))
}

export async function listPlayers(roomId: string): Promise<LobbyPlayer[]> {
  const { data, error } = await supabase
    .from('players')
    .select('id, nickname, joined_seq')
    .eq('room_id', roomId)
    .is('left_at', null)

  if (error) throw error
  return toLobbyPlayers(data as PlayerRow[])
}

/**
 * 입장·퇴장이 생길 때마다 목록을 다시 읽어 콜백으로 넘긴다.
 * 반환값을 호출하면 구독을 해제한다.
 */
export function subscribeToPlayers(roomId: string, onChange: (players: LobbyPlayer[]) => void): () => void {
  let channel: RealtimeChannel | null = supabase
    .channel(`room-players:${roomId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
      () => {
        listPlayers(roomId).then(onChange).catch(() => {})
      },
    )
    .subscribe()

  return () => {
    channel?.unsubscribe()
    channel = null
  }
}
