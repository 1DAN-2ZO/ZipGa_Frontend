import {
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
  useFonts,
} from '@expo-google-fonts/quicksand'
import { useState } from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { CreateRoom } from './src/screens/CreateRoom'
import { Home } from './src/screens/Home'
import { JoinRoom } from './src/screens/JoinRoom'
import { Lobby } from './src/screens/Lobby'
import { RoomSetup } from './src/screens/RoomSetup'
import { GameSandbox } from './src/screens/GameSandbox'
import { GoingHome } from './src/screens/GoingHome'
import { Settings } from './src/screens/Settings'
import { SessionResult } from './src/screens/SessionResult'
import { KAKAO_T_STORE, openKakaoTaxi, type TaxiLaunchResult } from './src/lib/kakaoTaxi'
import { colors } from './src/theme/colors'

const SCREENS = ['Home', 'RoomSetup', 'CreateRoom', 'JoinRoom', 'Lobby', 'SessionResult', 'GoingHome', 'Game', 'Settings'] as const
type ScreenName = (typeof SCREENS)[number]

const MOCK_LOBBY_PLAYERS = [
  { id: '1', nickname: 'PlayerOne', isHost: true, avgScore: 82, rank: 1, previousRank: 2 },
  { id: '2', nickname: 'PlayerTwo', isHost: false, avgScore: 65, rank: 2, previousRank: 1 },
  { id: '3', nickname: 'PlayerThree', isHost: false, avgScore: 51, rank: 3 },
  { id: '4', nickname: 'PlayerFour', isHost: false, avgScore: 32, rank: 4, previousRank: 4 },
  { id: '5', nickname: 'PlayerFive', isHost: false, avgScore: 18, rank: 5 },
]

const MOCK_RESULT_PLAYERS = [
  { id: '1', nickname: 'PlayerOne', avgScore: 98 },
  { id: '2', nickname: 'PlayerTwo', avgScore: 85 },
  { id: '3', nickname: 'PlayerThree', avgScore: 72 },
  { id: '4', nickname: 'PlayerFive', avgScore: 38 },
  { id: '5', nickname: 'PlayerSix', avgScore: 21 },
]

export default function App() {
  const [fontsLoaded] = useFonts({ Quicksand_500Medium, Quicksand_600SemiBold, Quicksand_700Bold })
  const [screen, setScreen] = useState<ScreenName>('Home')
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(true)
  const [backgroundMusicEnabled, setBackgroundMusicEnabled] = useState(true)
  const [launch, setLaunch] = useState<TaxiLaunchResult | null>(null)

  /** 벌칙 카운트다운이 끝나면 카카오T를 띄우고 귀가 화면으로 넘어간다. */
  const callTaxi = async () => {
    setLaunch(null)
    setScreen('GoingHome')
    setLaunch(await openKakaoTaxi())
  }

  if (!fontsLoaded) return null

  return (
    <View style={{ flex: 1 }}>
      {screen === 'Home' && (
        <Home
          nickname="PlayerOne"
          hasStoredRoom={false}
          onCreateRoom={() => setScreen('RoomSetup')}
          onJoinRoom={() => setScreen('JoinRoom')}
          onRejoin={() => {}}
          onSettings={() => setScreen('Settings')}
        />
      )}
      {screen === 'RoomSetup' && (
        <RoomSetup
          onBack={() => setScreen('Home')}
          onSettings={() => setScreen('Settings')}
          onNext={() => setScreen('CreateRoom')}
        />
      )}
      {screen === 'CreateRoom' && (
        <CreateRoom onBack={() => setScreen('Home')} onSettings={() => setScreen('Settings')} />
      )}
      {screen === 'JoinRoom' && (
        <JoinRoom
          onBack={() => setScreen('Home')}
          onSettings={() => setScreen('Settings')}
          onSubmitCode={() => {}}
        />
      )}
      {screen === 'Lobby' && (
        <Lobby
          players={MOCK_LOBBY_PLAYERS}
          threshold={40}
          isHost
          nextSessionLabel="12:34"
          canStart
          onStartSession={() => {}}
          onLeaveRoom={() => {}}
          onSettings={() => setScreen('Settings')}
        />
      )}
      {screen === 'SessionResult' && (
        <SessionResult
          players={MOCK_RESULT_PLAYERS}
          threshold={40}
          myPlayerId="4"
          onSettings={() => setScreen('Settings')}
          onCallTaxi={callTaxi}
          onBackToLobby={() => setScreen('Lobby')}
        />
      )}
      {screen === 'GoingHome' && (
        <GoingHome
          reason="penalty"
          launch={launch}
          onSettings={() => setScreen('Settings')}
          onOpenStore={() => {
            // 스킴은 이미 실패했다. 다시 시도하지 않고 스토어로 바로 보낸다.
            Linking.openURL(KAKAO_T_STORE).catch(() => {})
          }}
          onStay={() => setScreen('Lobby')}
        />
      )}
      {screen === 'Game' && <GameSandbox onSettings={() => setScreen('Settings')} />}
      {screen === 'Settings' && (
        <Settings
          soundEffectsEnabled={soundEffectsEnabled}
          backgroundMusicEnabled={backgroundMusicEnabled}
          onToggleSoundEffects={setSoundEffectsEnabled}
          onToggleBackgroundMusic={setBackgroundMusicEnabled}
          onBack={() => setScreen('Home')}
        />
      )}
      <DevSwitcher current={screen} onChange={setScreen} />
    </View>
  )
}

/** 개발 중 화면 미리보기 전환용. 실제 네비게이션이 붙으면 제거한다. */
function DevSwitcher({ current, onChange }: { current: ScreenName; onChange: (s: ScreenName) => void }) {
  return (
    <View style={styles.dev}>
      {SCREENS.map((s) => (
        <Pressable key={s} onPress={() => onChange(s)} style={[styles.devBtn, current === s && styles.devBtnActive]}>
          <Text style={styles.devText}>{s}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  dev: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#00000088',
  },
  devBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  devBtnActive: {
    backgroundColor: colors.primary,
  },
  devText: {
    color: 'white',
    fontSize: 10,
  },
})
