import { useEffect, useState } from 'react'
import { Keyboard, type LayoutChangeEvent } from 'react-native'

/** 이 높이보다 좁으면 축소본으로 간다. 키보드가 올라온 폰의 남는 높이 기준. */
export const COMPACT_HEIGHT = 560

export interface CompactLayout {
  /** 키보드에 자리를 뺏긴 상태인지. 화면을 접어야 한다는 뜻이다. */
  compact: boolean
  /** 게임 루트의 onLayout에 그대로 연결한다. */
  onLayout: (event: LayoutChangeEvent) => void
}

/**
 * 키보드로 화면이 좁아졌는지.
 *
 * 신호를 둘 다 보는 이유 — 플랫폼마다 알려주는 방식이 다르다.
 *   Android 네이티브 : 창이 resize된다 → 높이로 잡힌다
 *   iOS 네이티브     : 키보드가 덮기만 하고 높이는 그대로 → 이벤트로만 잡힌다
 *   웹              : react-native-web의 Keyboard.addListener는 빈 스텁이라
 *                     이벤트가 아예 안 온다 → 높이로만 잡힌다
 *
 * 입력이 있는 게임이 셋(문장 따라 쓰기·더하기 빼기·구구단)이라 한 벌만 둔다.
 * 이 판단이 어긋나면 화면이 겹치거나 잘리므로 각자 베껴 쓸 코드가 아니다.
 */
export function useCompactLayout(): CompactLayout {
  const [keyboardUp, setKeyboardUp] = useState(false)
  const [availableHeight, setAvailableHeight] = useState(0)

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardUp(true))
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardUp(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  return {
    // 키보드가 올라온 폰은 350~450 남는다. 안 올라온 폰은 700 이상이다.
    compact: keyboardUp || (availableHeight > 0 && availableHeight < COMPACT_HEIGHT),
    onLayout: (event) => setAvailableHeight(event.nativeEvent.layout.height),
  }
}
