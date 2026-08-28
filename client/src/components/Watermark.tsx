import { Image, StyleSheet, View } from 'react-native'

/**
 * 모든 화면 배경 중앙에 옅게 깔리는 로고.
 *
 * 화면의 첫 번째 자식으로 넣는다 — 그래야 각 화면의 backgroundColor 위에,
 * 나머지 내용(헤더·버튼 등) 아래에 깔린다. 터치를 가로채면 안 되므로
 * pointerEvents="none".
 */
export function Watermark() {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Image
        source={require('../../assets/zipga_logo.png')}
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 280,
    height: 177,
    opacity: 0.5,
  },
})
