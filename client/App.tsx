import {
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
  useFonts,
} from '@expo-google-fonts/quicksand'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { NicknameSheet } from './src/components/NicknameSheet'
import { getGame } from './src/games/registry'
import { ROUNDS_PER_SESSION, type GameResult } from './src/games/types'
import { parseRoomDeepLink } from './src/lib/deepLink'
import { KAKAO_T_STORE, openKakaoTaxi, type TaxiLaunchResult } from './src/lib/kakaoTaxi'
import {
  clearStoredRoomCode,
  getStoredNickname,
  getStoredRoomCode,
  setStoredNickname,
  setStoredRoomCode,
} from './src/lib/localProfile'
import { supabase } from './src/lib/supabase'
import {
  checkRoom,
  createRoom,
  ensureAnonymousSession,
  joinRoom,
  leaveRoom,
  rejoinRoom,
  RoomError,
  setSessionPeriod,
} from './src/room/api'
import { listAllRoomPlayersEver, listPlayers, subscribeToPlayers } from './src/room/players'
import { listSessionScores } from './src/room/scores'
import { getActiveSessionId, subscribeActiveSession, subscribeSessionStart } from './src/room/sessions'
import { CreateRoom } from './src/screens/CreateRoom'
import { Countdown } from './src/screens/Countdown'
import { GameHost } from './src/screens/GameHost'
import { GameReveal } from './src/screens/GameReveal'
import { GameSandbox } from './src/screens/GameSandbox'
import { GoingHome } from './src/screens/GoingHome'
import { Home } from './src/screens/Home'
import { JoinRoom } from './src/screens/JoinRoom'
import { Lobby, type LobbyPlayer } from './src/screens/Lobby'
import { NextSessionWait } from './src/screens/NextSessionWait'
import { RoomSetup } from './src/screens/RoomSetup'
import { RoundResult } from './src/screens/RoundResult'
import { SessionResult, type ResultPlayer } from './src/screens/SessionResult'
import { Settings } from './src/screens/Settings'
import { colors } from './src/theme/colors'
import GameCheckHarness from './src/dev/GameCheckHarness'
import { createClock } from './src/session/clock'
import { serverNowMs, SessionError, type RpcClient } from './src/session/api'
import { currentRound, sessionAverage } from './src/session/machine'
import { useSession } from './src/session/useSession'

/**
 * session/api.ts는 순수 Promise를 반환하는 RpcClient를 기대하는데,
 * supabase.rpc()는 구조적으로 다른 thenable(PostgrestFilterBuilder)을 반환한다.
 * 얇게 감싸서 맞춘다.
 */
const sessionRpcClient: RpcClient = {
  async rpc(fn, args) {
    const { data, error } = await supabase.rpc(fn, args)
    return { data, error }
  },
}

const SCREENS = [
  'Home',
  'RoomSetup',
  'CreateRoom',
  'JoinRoom',
  'Lobby',
  'NextSessionWait',
  'GameReveal',
  'Countdown',
  'GameHost',
  'RoundResult',
  'SessionResult',
  'GoingHome',
  'Game',
  'Settings',
  'GameCheck',
] as const
type ScreenName = (typeof SCREENS)[number]

function roomErrorMessage(e: unknown): string {
  if (e instanceof RoomError || e instanceof SessionError) {
    switch (e.code) {
      case 'ROOM_NOT_FOUND':
        return '방을 찾을 수 없어요.'
      case 'ROOM_EXPIRED':
        return '방이 사라졌어요.'
      case 'PLAYER_NOT_FOUND':
        return '이 방에서 회원님을 찾을 수 없어요.'
      case 'AUTH_REQUIRED':
        return '로그인이 필요해요. 앱을 다시 시작해주세요.'
      case 'NOT_IN_ROOM':
        return '방 멤버가 아니에요.'
      case 'NOT_HOST':
        return '방장만 할 수 있어요.'
      case 'SESSION_IN_PROGRESS':
        return '이미 게임이 진행 중이에요.'
      case 'SESSION_NOT_ACTIVE':
        return '세션이 이미 끝났어요.'
      case 'NOT_ENOUGH_PLAYERS':
        return '2명부터 시작할 수 있어요.'
      case 'BAD_PERIOD':
        return '잘못된 주기 값이에요.'
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
  /** end_session 응답을 못 받았을 때(누군가 이미 먼저 끝냄) 직접 재구성한 전체 순위 */
  const [fallbackResultPlayers, setFallbackResultPlayers] = useState<ResultPlayer[] | null>(null)
  /** 이 방에 지금 진행 중인(끝나지 않은) 세션이 있는지. S11 대기 화면 라우팅에만 쓴다 */
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  const [nicknameSheetVisible, setNicknameSheetVisible] = useState(false)
  const pendingAfterNicknameRef = useRef<((nickname: string) => void) | null>(null)
  const initialDeepLinkHandledRef = useRef(false)

  // 폰 시계가 아니라 서버 보정 시각 기준으로 카운트다운을 맞춘다 (한 번 만들어 계속 쓴다)
  const clockRef = useRef(
    createClock({ fetchServerNowMs: () => serverNowMs(sessionRpcClient), localNowMs: () => Date.now() }),
  )

  const sessionDeps = useMemo(
    () => ({
      client: sessionRpcClient,
      clock: clockRef.current,
      subscribeSessionStart: (cb: Parameters<typeof subscribeSessionStart>[1]) =>
        roomId ? subscribeSessionStart(roomId, cb) : () => {},
    }),
    [roomId],
  )
  const session = useSession(sessionDeps)

  // 앱 최초 실행 1회: 익명 로그인 + 로컬에 저장된 닉네임·방 코드 로드
  useEffect(() => {
    ;(async () => {
      try {
        await ensureAnonymousSession()
      } catch (e) {
        console.warn('익명 로그인 실패', e)
      }
      try {
        await clockRef.current.sync()
      } catch (e) {
        console.warn('서버 시각 동기화 실패', e)
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

  // 이 방에 지금 진행 중인 세션이 있는지 계속 최신으로 들고 있는다. 세션 도중에 새로
  // 입장·재입장한 사람을 로비 대신 대기 화면(S11)으로 돌리는 데만 쓴다.
  useEffect(() => {
    if (!roomId) {
      setActiveSessionId(null)
      return
    }
    getActiveSessionId(roomId).then(setActiveSessionId).catch(() => {})
    return subscribeActiveSession(roomId, setActiveSessionId)
  }, [roomId])

  // 세션이 시작되면(방장이 눌렀든, 참가자로서 Realtime으로 알게 됐든) 로비를 벗어나
  // 게임 3개 공개(S4)로 넘어간다. 그 뒤 단계는 각 화면의 onDone이 직접 넘긴다.
  useEffect(() => {
    if (screen === 'Lobby' && session.state?.phase === 'lineup') {
      setFallbackResultPlayers(null) // 지난 세션의 잔여 결과를 지운다
      setScreen('GameReveal')
    }
  }, [screen, session.state])

  // 이미 진행 중인 세션의 sessions INSERT는 놓쳤으므로(subscribeSessionStart는 그 이후의
  // INSERT만 본다) session.state가 안 채워진다 — 그런 사람은 로비 대신 대기 화면으로 보낸다.
  // (mdfile/프론트엔드_화면명세.md S11 — "세션 도중 입장·재입장한 사람은 끼지 않는다")
  useEffect(() => {
    if (screen === 'Lobby' && activeSessionId !== null && session.state === null) {
      setScreen('NextSessionWait')
    }
  }, [screen, activeSessionId, session.state])

  // 대기 중이던 세션이 끝나면(activeSessionId가 null이 되면) 자동으로 로비로 돌아간다.
  useEffect(() => {
    if (screen === 'NextSessionWait' && activeSessionId === null) {
      setScreen('Lobby')
    }
  }, [screen, activeSessionId])

  // end_session은 "먼저 도착한 한 번만" 실행된다 — 뒤에 도착한 클라이언트는
  // 이 자리에서 SESSION_NOT_ACTIVE를 받는데, 이건 실제 오류가 아니라 예상된 경쟁
  // 결과다. 서버 응답 대신 raw 점수를 직접 읽어 같은 계산을 재구성한다.
  // (내 생존/탈락 판정 자체는 이 결과와 무관하게 로컬로 이미 확정돼 있다 — SessionResult 참고)
  useEffect(() => {
    if (session.state?.phase !== 'final' || session.verdict !== null) return
    if (session.error !== 'SESSION_NOT_ACTIVE') return
    if (!session.sessionId || !roomId) return

    let cancelled = false
    ;(async () => {
      try {
        const [rows, allPlayers] = await Promise.all([
          listSessionScores(session.sessionId as string),
          listAllRoomPlayersEver(roomId),
        ])
        const totals = new Map<string, number>()
        for (const row of rows) {
          totals.set(row.playerId, (totals.get(row.playerId) ?? 0) + row.normalized)
        }
        const nameOf = new Map(allPlayers.map((p) => [p.id, p.nickname]))
        const reconstructed: ResultPlayer[] = [...totals.entries()].map(([playerId, sum]) => ({
          id: playerId,
          nickname: nameOf.get(playerId) ?? '???',
          avgScore: sum / ROUNDS_PER_SESSION,
        }))
        if (!cancelled) setFallbackResultPlayers(reconstructed)
      } catch (e) {
        // 벌칙으로 이미 방을 나간 경우 RLS상 이 조회도 막힌다 — 그럴 땐 전체 순위 없이
        // 내 결과(로컬 확정값)만 보여주는 것으로 충분하다.
        console.warn('세션 결과 재구성 실패', e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [session.state, session.verdict, session.error, session.sessionId, roomId])

  useEffect(() => {
    const isBenignRaceLoss = session.error === 'SESSION_NOT_ACTIVE' && session.state?.phase === 'final'
    if (session.error && !isBenignRaceLoss) {
      Alert.alert('알림', roomErrorMessage(new SessionError(session.error, session.error)))
    }
  }, [session.error, session.state])

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

  async function handleRoomSetupNext(intervalMinutes: number) {
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
      try {
        await setSessionPeriod(intervalMinutes)
      } catch (e) {
        console.warn('set_session_period 실패', e)
      }
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

  // --- 세션 흐름(S4~S8) 화면 전환. 시작 신호만 Realtime이고 그 뒤는 각자 폰에서 진행된다. ---
  function handleGameRevealDone() {
    session.advance({ type: 'LINEUP_SHOWN' })
    setScreen('Countdown')
  }

  function handleCountdownDone() {
    session.advance({ type: 'COUNTDOWN_DONE' })
    setScreen('GameHost')
  }

  function handleRoundFinished(result: GameResult) {
    session.advance({ type: 'ROUND_FINISHED', result })
    setScreen('RoundResult')
  }

  function handleRoundResultDone() {
    const isLast = (session.state?.roundIndex ?? 0) + 1 >= ROUNDS_PER_SESSION
    session.advance({ type: 'ROUND_RESULT_DONE' })
    setScreen(isLast ? 'SessionResult' : 'Countdown')
  }

  if (!fontsLoaded || booting) return null

  const isHost = lobbyPlayers.length > 0 && lobbyPlayers[0].id === myPlayerId
  // 서버 응답과 무관하게 항상 확정되는 내 3판 평균. final 이전엔 null이라 0으로 방어한다
  // (SessionResult는 phase==='final'일 때만 렌더링되므로 실제로는 항상 값이 있다).
  const myAverage = (session.state && sessionAverage(session.state)) ?? 0

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
          onNext={(intervalMinutes) => {
            handleRoomSetupNext(intervalMinutes)
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
          // 세션 엔진(S4~S8)이 아직 안 붙어서 이 방에서 세션이 끝난 적이 없다 — 계산할
          // 근거(session_period_min, 마지막 ended_at)가 없으므로 타이머 없음(null)이 맞다.
          nextSessionLabel={null}
          canStart={lobbyPlayers.length >= 2}
          onStartSession={() => session.start()}
          onLeaveRoom={handleLeaveRoom}
          onSettings={() => setScreen('Settings')}
          onShowInviteQr={() => {
            setCreateRoomOrigin('Lobby')
            setScreen('CreateRoom')
          }}
        />
      )}
      {screen === 'NextSessionWait' && <NextSessionWait onSettings={() => setScreen('Settings')} />}
      {session.state && screen === 'GameReveal' && (
        <GameReveal plan={session.state.plan} onDone={handleGameRevealDone} />
      )}
      {session.state && session.startsAtMs !== null && screen === 'Countdown' && (
        <Countdown
          startsAtMs={session.startsAtMs}
          now={() => clockRef.current.now()}
          gameEmoji={getGame(currentRound(session.state).gameId).info.emoji}
          gameName={getGame(currentRound(session.state).gameId).info.name}
          gameDesc={getGame(currentRound(session.state).gameId).info.desc}
          timeLimitSec={currentRound(session.state).timeLimitSec}
          onDone={handleCountdownDone}
        />
      )}
      {session.state && screen === 'GameHost' && (
        <GameHost
          gameId={currentRound(session.state).gameId}
          seed={currentRound(session.state).seed}
          timeLimitSec={currentRound(session.state).timeLimitSec}
          onFinish={handleRoundFinished}
        />
      )}
      {session.state && session.sessionId && screen === 'RoundResult' && (
        <RoundResult
          sessionId={session.sessionId}
          roundIndex={session.state.roundIndex}
          players={lobbyPlayers}
          myPlayerId={myPlayerId ?? ''}
          gameName={getGame(currentRound(session.state).gameId).info.name}
          onDone={handleRoundResultDone}
        />
      )}
      {screen === 'SessionResult' && (
        <SessionResult
          myAverage={myAverage}
          players={
            session.verdict !== null
              ? session.verdict.map((v) => ({ id: v.playerId, nickname: v.nickname, avgScore: v.avgScore }))
              : fallbackResultPlayers
          }
          threshold={40}
          myPlayerId={myPlayerId ?? ''}
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
