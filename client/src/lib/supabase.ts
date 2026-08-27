import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY가 없습니다. client/.env를 확인하세요.',
  )
}

/**
 * AsyncStorage를 반드시 물려준다.
 *
 * 안 하면 앱을 껐다 켤 때마다 익명 uid가 새로 생겨 "아직 안 갈래"가 영구히 깨진다.
 * (mdfile/프론트엔드_화면명세.md S0 참고)
 */
export const supabase = createClient(url, publishableKey, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})

export const SUPABASE_URL = url
export const SUPABASE_PUBLISHABLE_KEY = publishableKey

/**
 * 지금 로그인된 세션의 access token을 메모리에 들고 있는다.
 *
 * pagehide(탭 닫기) 핸들러는 await할 시간이 없다 — 브라우저가 그 틱 사이에
 * 페이지를 버릴 수 있다. supabase.auth.getSession()을 그 안에서 부르면
 * 비동기 한 틱이 끼어드는데, 여기서는 값을 미리 동기로 들고 있다가 그대로
 * 쓴다. onAuthStateChange는 구독 즉시 현재 세션으로 한 번 불러주므로
 * (INITIAL_SESSION) 앱이 뜨자마자 채워진다.
 */
let cachedAccessToken: string | null = null
supabase.auth.onAuthStateChange((_event, session) => {
  cachedAccessToken = session?.access_token ?? null
})

export function getCachedAccessToken(): string | null {
  return cachedAccessToken
}
