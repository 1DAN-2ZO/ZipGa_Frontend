import { supabase } from '../lib/supabase'

/** mdfile/백엔드_Supabase명세.md §9. 백엔드가 raise exception으로 던지는 코드들. */
export const ROOM_ERROR_CODES = [
  'AUTH_REQUIRED',
  'ROOM_NOT_FOUND',
  'ROOM_EXPIRED',
  'PLAYER_NOT_FOUND',
  'NOT_IN_ROOM',
  'NOT_HOST',
  'SESSION_IN_PROGRESS',
  'SESSION_NOT_ACTIVE',
  'NOT_ENOUGH_PLAYERS',
  'BAD_PERIOD',
] as const

export type RoomErrorCode = (typeof ROOM_ERROR_CODES)[number] | 'UNKNOWN'

export class RoomError extends Error {
  readonly code: RoomErrorCode

  constructor(code: RoomErrorCode, message: string) {
    super(message)
    this.name = 'RoomError'
    this.code = code
  }
}

/** Postgres가 접두사를 붙여 보내도(P0001: 등) 알려진 코드를 찾아낸다. */
function toRoomError(message: string): RoomError {
  const found = ROOM_ERROR_CODES.find((code) => message.includes(code))
  return new RoomError(found ?? 'UNKNOWN', message)
}

async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw toRoomError(error.message)
  return data as T
}

/** 앱 최초 실행 시 1회. 세션이 이미 있으면 아무것도 하지 않는다. */
export async function ensureAnonymousSession(): Promise<void> {
  const { data } = await supabase.auth.getSession()
  if (data.session) return

  const { error } = await supabase.auth.signInAnonymously()
  if (error) throw new RoomError('AUTH_REQUIRED', error.message)
}

export interface CreatedRoom {
  roomId: string
  roomCode: string
  playerId: string
}

export async function createRoom(nickname: string): Promise<CreatedRoom> {
  const rows = await call<Array<{ room_id: string; room_code: string; player_id: string }>>(
    'create_room',
    { p_nickname: nickname },
  )
  const row = rows[0]
  return { roomId: row.room_id, roomCode: row.room_code, playerId: row.player_id }
}

/** 가입 없이 코드로 방이 있는지만 확인한다 (닉네임을 받기 전에 먼저 부른다). */
export async function checkRoom(code: string): Promise<{ roomId: string }> {
  const rows = await call<Array<{ room_id: string }>>('check_room', { p_code: code })
  return { roomId: rows[0].room_id }
}

export interface JoinedRoom {
  roomId: string
  playerId: string
}

export async function joinRoom(code: string, nickname: string): Promise<JoinedRoom> {
  const rows = await call<Array<{ room_id: string; player_id: string }>>('join_room', {
    p_code: code,
    p_nickname: nickname,
  })
  const row = rows[0]
  return { roomId: row.room_id, playerId: row.player_id }
}

export async function rejoinRoom(code: string): Promise<JoinedRoom> {
  const rows = await call<Array<{ room_id: string; player_id: string }>>('rejoin_room', {
    p_code: code,
  })
  const row = rows[0]
  return { roomId: row.room_id, playerId: row.player_id }
}

export async function leaveRoom(): Promise<void> {
  await call('leave_room')
}

/** 방장이 방 세팅(S1/RoomSetup)에서 고른 게임 텀을 반영한다. 30/45/60만 허용된다. */
export async function setSessionPeriod(minutes: number): Promise<void> {
  await call('set_session_period', { p_minutes: minutes })
}
