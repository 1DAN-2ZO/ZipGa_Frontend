import { Alert, Platform } from 'react-native'
import { colors } from '../theme/colors'

export interface AlertOptions {
  title: string
  text?: string
  icon?: 'success' | 'warning' | 'error' | 'info'
}

/**
 * 배포 목표가 웹으로 바뀌면서(2026-08-26) 웹에서는 sweetalert2로, 혹시 네이티브에서
 * 돌아갈 때는 RN 기본 Alert로 떨어진다 — sweetalert2는 DOM 기반이라 순수 네이티브
 * 런타임에는 없는 API(document 등)를 쓰므로 절대 로드되면 안 된다. Platform.OS 분기
 * 안에서 동적 import해서, 네이티브 번들이 이 모듈을 평가할 일 자체를 없앤다.
 */
export async function showAlert({ title, text, icon }: AlertOptions): Promise<void> {
  if (Platform.OS === 'web') {
    const Swal = (await import('sweetalert2')).default
    await Swal.fire({
      title,
      text,
      icon,
      confirmButtonColor: colors.primary,
      background: colors.white,
    })
    return
  }

  Alert.alert(title, text)
}
