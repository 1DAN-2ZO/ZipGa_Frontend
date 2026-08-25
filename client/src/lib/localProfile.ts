import AsyncStorage from '@react-native-async-storage/async-storage'

const NICKNAME_KEY = 'zipga.nickname'
const ROOM_CODE_KEY = 'zipga.roomCode'

export async function getStoredNickname(): Promise<string | null> {
  return AsyncStorage.getItem(NICKNAME_KEY)
}

export async function setStoredNickname(nickname: string): Promise<void> {
  await AsyncStorage.setItem(NICKNAME_KEY, nickname)
}

export async function getStoredRoomCode(): Promise<string | null> {
  return AsyncStorage.getItem(ROOM_CODE_KEY)
}

export async function setStoredRoomCode(code: string): Promise<void> {
  await AsyncStorage.setItem(ROOM_CODE_KEY, code)
}

export async function clearStoredRoomCode(): Promise<void> {
  await AsyncStorage.removeItem(ROOM_CODE_KEY)
}
