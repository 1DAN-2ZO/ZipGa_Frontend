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
