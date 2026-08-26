import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { LobbyPlayer } from '../screens/Lobby'
import { getRoomStandings, type PlayerStanding } from './standings'

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
 * 방 참가자 목록. 아직 한 번도 세션을 안 뛴 사람은 avgScore 0으로 맨 뒤 쪽에 깔린다
 * (standings.ts가 안 돌아본 세션은 애초에 데이터가 없으니 자연스럽게 0).
 *
 * 순위는 입장 순서가 아니라 실제 누적 평균 점수 내림차순이다 — 이게 이 목록의
 * 존재 이유다. 방장 판단은 정렬과 무관하게 host_player_id로 따로 한다
 * (host_player_id를 못 읽었을 때만 최초 입장자로 대체 — joined_seq 최솟값을 직접 찾는다,
 * 정렬 순서에 기대지 않는다).
 */
function toLobbyPlayers(
  rows: PlayerRow[],
  hostPlayerId: string | null,
  standings: Map<string, PlayerStanding>,
): LobbyPlayer[] {
  const earliestJoinedId = rows.reduce<PlayerRow | null>(
    (earliest, row) => (earliest === null || row.joined_seq < earliest.joined_seq ? row : earliest),
    null,
  )?.id

  return [...rows]
    .sort((a, b) => {
      const scoreA = standings.get(a.id)?.avgScore ?? 0
      const scoreB = standings.get(b.id)?.avgScore ?? 0
      if (scoreB !== scoreA) return scoreB - scoreA
      return a.joined_seq - b.joined_seq // 동점이면 입장 순서로 안정 정렬
    })
    .map((row, index) => ({
      id: row.id,
      nickname: row.nickname,
      isHost: hostPlayerId !== null ? row.id === hostPlayerId : row.id === earliestJoinedId,
      avgScore: standings.get(row.id)?.avgScore ?? 0,
      rank: index + 1,
      previousRank: standings.get(row.id)?.previousRank,
    }))
}

export async function listPlayers(roomId: string): Promise<LobbyPlayer[]> {
  const [{ data, error }, hostPlayerId, standings] = await Promise.all([
    supabase.from('players').select('id, nickname, joined_seq').eq('room_id', roomId).is('left_at', null),
    fetchHostPlayerId(roomId).catch(() => null),
    getRoomStandings(roomId).catch(() => new Map<string, PlayerStanding>()),
  ])

  if (error) throw error
  return toLobbyPlayers(data as PlayerRow[], hostPlayerId, standings)
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
 * 입장·퇴장이 생길 때마다(players 변화) 목록을 다시 읽어 콜백으로 넘긴다.
 * 반환값을 호출하면 구독을 해제한다.
 *
 * ⚠️ rooms 테이블은 여기서 구독하지 않는다 — rooms는 supabase_realtime publication에
 * 없어서(20260825033434_realtime.sql) 그 UPDATE는 애초에 전달되지 않을 뿐 아니라,
 * 같은 채널에 발행 안 된 테이블 리스너를 같이 걸면 채널 전체(players 리스너까지)가
 * 조용히 죽어버린다 — 실제로 재현·확인했다. 다행히 방장이 바뀌는 모든 경로
 * (_remove_player·rejoin_room)는 항상 players 행도 같이 바꾸므로, players만 구독해도
 * host_player_id 변화(listPlayers 안의 fetchHostPlayerId)를 놓치지 않는다.
 */
export function subscribeToPlayers(roomId: string, onChange: (players: LobbyPlayer[]) => void): () => void {
  const refresh = () => {
    listPlayers(roomId).then(onChange).catch(() => {})
  }

  let channel: RealtimeChannel | null = supabase
    .channel(`room-players:${roomId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, refresh)
    .subscribe()

  return () => {
    channel?.unsubscribe()
    channel = null
  }
}
