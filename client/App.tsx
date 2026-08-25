import {
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
  useFonts,
} from '@expo-google-fonts/quicksand'
import { useEffect, useRef, useState } from 'react'
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { NicknameSheet } from './src/components/NicknameSheet'
import { parseRoomDeepLink } from './src/lib/deepLink'
import { KAKAO_T_STORE, openKakaoTaxi, type TaxiLaunchResult } from './src/lib/kakaoTaxi'
import {
  clearStoredRoomCode,
  getStoredNickname,
  getStoredRoomCode,
  setStoredNickname,
  setStoredRoomCode,
} from './src/lib/localProfile'
import { checkRoom, createRoom, ensureAnonymousSession, joinRoom, leaveRoom, rejoinRoom, RoomError } from './src/room/api'
import { listPlayers, subscribeToPlayers } from './src/room/players'
import { CreateRoom } from './src/screens/CreateRoom'
import { GoingHome } from './src/screens/GoingHome'
import { Home } from './src/screens/Home'
import { JoinRoom } from './src/screens/JoinRoom'
import { Lobby, type LobbyPlayer } from './src/screens/Lobby'
import { RoomSetup } from './src/screens/RoomSetup'
import { GameSandbox } from './src/screens/GameSandbox'
import { GoingHome } from './src/screens/GoingHome'
import { Settings } from './src/screens/Settings'
import { SessionResult } from './src/screens/SessionResult'
import { Settings } from './src/screens/Settings'
import { colors } from './src/theme/colors'
import GameCheckHarness from './src/dev/GameCheckHarness'

const SCREENS = ['Home', 'RoomSetup', 'CreateRoom', 'JoinRoom', 'Lobby', 'SessionResult', 'GoingHome', 'Game', 'Settings'] as const
type ScreenName = (typeof SCREENS)[number]

const MOCK_RESULT_PLAYERS = [
  { id: '1', nickname: 'PlayerOne', avgScore: 98 },
  { id: '2', nickname: 'PlayerTwo', avgScore: 85 },
  { id: '3', nickname: 'PlayerThree', avgScore: 72 },
  { id: '4', nickname: 'PlayerFive', avgScore: 38 },
  { id: '5', nickname: 'PlayerSix', avgScore: 21 },
]

function roomErrorMessage(e: unknown): string {
  if (e instanceof RoomError) {
    switch (e.code) {
      case 'ROOM_NOT_FOUND':
        return '방을 찾을 수 없어요.'
      case 'ROOM_EXPIRED':
        return '방이 사라졌어요.'
      case 'PLAYER_NOT_FOUND':
        return '이 방에서 회원님을 찾을 수 없어요.'
      case 'AUTH_REQUIRED':
        return '로그인이 필요해요. 앱을 다시 시작해주세요.'
      default:
        return '알 수 없는 오류가 발생했어요.'
    }
  }
  return '알 수 없는 오류가 발생했어요.'
}

export default function App() {
  const [fontsLoaded] = useFonts({ Quicksand_500Medium, Quicksand_600SemiBold, Quicksand_700Bold })
  const [booting, setBooting] = useState(true)
  const [screen, setScreen] = useState<ScreenName>('Home')
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(true)
  const [backgroundMusicEnabled, setBackgroundMusicEnabled] = useState(true)
  const [launch, setLaunch] = useState<TaxiLaunchResult | null>(null)
  /** CreateRoom의 뒤로가기가 어디로 돌아갈지. Home에서 새로 만들 때와 Lobby에서 재초대할 때가 다르다 */
  const [createRoomOrigin, setCreateRoomOrigin] = useState<'Home' | 'Lobby'>('Home')

  // --- 백엔드 연동 상태 ---
  const [nickname, setNickname] = useState<string | null>(null)
  const [storedRoomCode, setStoredRoomCodeState] = useState<string | null>(null)
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  /** 지금 속한 방의 코드. CreateRoom·재초대 화면이 그대로 보여준다 */
  const [activeRoomCode, setActiveRoomCode] = useState<string | null>(null)
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [createRoomError, setCreateRoomError] = useState<string | null>(null)
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([])

  const [nicknameSheetVisible, setNicknameSheetVisible] = useState(false)
  const pendingAfterNicknameRef = useRef<((nickname: string) => void) | null>(null)
  const initialDeepLinkHandledRef = useRef(false)

  // 앱 최초 실행 1회: 익명 로그인 + 로컬에 저장된 닉네임·방 코드 로드
  useEffect(() => {
    ;(async () => {
      try {
        await ensureAnonymousSession()
      } catch (e) {
        console.warn('익명 로그인 실패', e)
      }
      const [storedNickname, code] = await Promise.all([getStoredNickname(), getStoredRoomCode()])
      setNickname(storedNickname)
      setStoredRoomCodeState(code)
      setBooting(false)
    })()
  }, [])

  // 방에 들어와 있는 동안 참가자 목록을 실시간으로 받는다
  useEffect(() => {
    if (!roomId) {
      setLobbyPlayers([])
      return
    }
    listPlayers(roomId).then(setLobbyPlayers).catch(() => {})
    return subscribeToPlayers(roomId, setLobbyPlayers)
  }, [roomId])

  // 초대 딥링크(jipga://room/{code})로 들어온 경우. QR 스캔을 건너뛰고 바로 참여로 간다.
  // (mdfile/프론트엔드_화면명세.md S2 — "딥링크 진입도 같은 경로를 탄다")
  useEffect(() => {
    if (booting) return

    function handleUrl(url: string) {
      const code = parseRoomDeepLink(url)
      if (!code) return
      setScreen('JoinRoom')
      handleCheckAndJoin(code)
    }

    if (!initialDeepLinkHandledRef.current) {
      initialDeepLinkHandledRef.current = true
      Linking.getInitialURL().then((url) => {
        if (url) handleUrl(url)
      })
    }

    const subscription = Linking.addEventListener('url', ({ url }) => handleUrl(url))
    return () => subscription.remove()
  }, [booting, nickname])

  /**
   * nickname이 없으면 먼저 입력 시트를 띄우고, 확인되면 action을 이어서 실행한다.
   *
   * action에는 확정된 닉네임을 인자로 넘긴다 — setNickname은 비동기라 action을 부르는
   * 시점에 컴포넌트의 nickname state가 아직 갱신되지 않았을 수 있기 때문이다.
   */
  function requireNickname(action: (nickname: string) => void) {
    if (nickname) {
      action(nickname)
      return
    }
    pendingAfterNicknameRef.current = action
    setNicknameSheetVisible(true)
  }

  async function handleNicknameConfirm(value: string) {
    await setStoredNickname(value)
    setNickname(value)
    setNicknameSheetVisible(false)
    const action = pendingAfterNicknameRef.current
    pendingAfterNicknameRef.current = null
    action?.(value)
  }

  async function handleRoomSetupNext() {
    // TODO: set_session_period 호출은 세션 엔진이 붙으면 같이 넣는다. 지금은 방 생성에만 쓴다.
    setScreen('CreateRoom')
    setCreatingRoom(true)
    setCreateRoomError(null)
    try {
      const result = await createRoom(nickname as string)
      setRoomId(result.roomId)
      setMyPlayerId(result.playerId)
      setActiveRoomCode(result.roomCode)
      await setStoredRoomCode(result.roomCode)
      setStoredRoomCodeState(result.roomCode)
    } catch (e) {
      setCreateRoomError(roomErrorMessage(e))
    } finally {
      setCreatingRoom(false)
    }
  }

  /**
   * JoinRoom 화면에서 코드를 확정했을 때 첫 번째로 부른다.
   * 방이 실제로 있는지부터 확인하고(가입은 안 함), 확인되면 그때 닉네임을 받는다.
   * (mdfile/프론트엔드_화면명세.md S2 — "방을 먼저 찾고 그다음에 이름을 묻는다")
   */
  async function handleCheckAndJoin(code: string) {
    setJoinLoading(true)
    setJoinError(null)
    try {
      await checkRoom(code)
      setJoinLoading(false)
      requireNickname((nick) => handleSubmitJoinCode(code, nick))
    } catch (e) {
      setJoinLoading(false)
      setJoinError(roomErrorMessage(e))
    }
  }

  async function handleSubmitJoinCode(code: string, nicknameOverride?: string) {
    const nick = nicknameOverride ?? nickname
    if (!nick) return
    setJoinLoading(true)
    setJoinError(null)
    try {
      const result = await joinRoom(code, nick)
      setRoomId(result.roomId)
      setMyPlayerId(result.playerId)
      const normalized = code.toUpperCase()
      setActiveRoomCode(normalized)
      await setStoredRoomCode(normalized)
      setStoredRoomCodeState(normalized)
      setScreen('Lobby')
    } catch (e) {
      setJoinError(roomErrorMessage(e))
    } finally {
      setJoinLoading(false)
    }
  }

  async function handleRejoin() {
    if (!storedRoomCode) return
    try {
      const result = await rejoinRoom(storedRoomCode)
      setRoomId(result.roomId)
      setMyPlayerId(result.playerId)
      setActiveRoomCode(storedRoomCode)
      setScreen('Lobby')
    } catch (e) {
      Alert.alert('알림', roomErrorMessage(e))
      if (e instanceof RoomError && ['ROOM_EXPIRED', 'ROOM_NOT_FOUND', 'PLAYER_NOT_FOUND'].includes(e.code)) {
        await clearStoredRoomCode()
        setStoredRoomCodeState(null)
      }
    }
  }

  async function handleLeaveRoom() {
    try {
      await leaveRoom()
    } catch (e) {
      console.warn('leave_room 실패', e)
    }
    await clearStoredRoomCode()
    setStoredRoomCodeState(null)
    setActiveRoomCode(null)
    setRoomId(null)
    setMyPlayerId(null)
    setScreen('Home')
  }

  /** 벌칙 카운트다운이 끝나면 카카오T를 띄우고 귀가 화면으로 넘어간다. */
  const callTaxi = async () => {
    setLaunch(null)
    setScreen('GoingHome')
    setLaunch(await openKakaoTaxi())
  }

  if (!fontsLoaded || booting) return null

  const isHost = lobbyPlayers.length > 0 && lobbyPlayers[0].id === myPlayerId

  return (
    <View style={{ flex: 1 }}>
      {screen === 'Home' && (
        <Home
          nickname={nickname ?? undefined}
          hasStoredRoom={!!storedRoomCode}
          onCreateRoom={() =>
            requireNickname(() => {
              setCreateRoomOrigin('Home')
              setScreen('RoomSetup')
            })
          }
          onJoinRoom={() => setScreen('JoinRoom')}
          onRejoin={handleRejoin}
          onSettings={() => setScreen('Settings')}
        />
      )}
      {screen === 'RoomSetup' && (
        <RoomSetup
          onBack={() => setScreen('Home')}
          onSettings={() => setScreen('Settings')}
          onNext={() => {
            handleRoomSetupNext()
          }}
        />
      )}
      {screen === 'CreateRoom' && (
        <CreateRoom
          roomCode={creatingRoom ? null : activeRoomCode}
          errorMessage={createRoomError}
          onBack={() => setScreen(createRoomOrigin)}
          onSettings={() => setScreen('Settings')}
          onDone={createRoomOrigin === 'Home' ? () => setScreen('Lobby') : undefined}
        />
      )}
      {screen === 'JoinRoom' && (
        <JoinRoom
          onBack={() => setScreen('Home')}
          onSettings={() => setScreen('Settings')}
          onSubmitCode={handleCheckAndJoin}
          loading={joinLoading}
          errorMessage={joinError}
        />
      )}
      {screen === 'Lobby' && (
        <Lobby
          players={lobbyPlayers}
          threshold={40}
          isHost={isHost}
          nextSessionLabel="12:34"
          canStart
          onStartSession={() => {}}
          onLeaveRoom={handleLeaveRoom}
          onSettings={() => setScreen('Settings')}
          onShowInviteQr={() => {
            setCreateRoomOrigin('Lobby')
            setScreen('CreateRoom')
          }}
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
      {/* 게임 담당자들이 시드 결정성을 두 폰에서 맞춰보는 확인용 화면. 실제 흐름과 무관하다 */}
      {screen === 'GameCheck' && <GameCheckHarness />}

      <NicknameSheet
        visible={nicknameSheetVisible}
        initialNickname={nickname ?? undefined}
        onConfirm={handleNicknameConfirm}
        onCancel={() => {
          pendingAfterNicknameRef.current = null
          setNicknameSheetVisible(false)
        }}
      />

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
