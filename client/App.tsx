import {
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
  useFonts,
} from '@expo-google-fonts/quicksand'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Linking, Platform, View } from 'react-native'
import { NicknameSheet } from './src/components/NicknameSheet'
import { getGame } from './src/games/registry'
import { ROUNDS_PER_SESSION, type GameResult } from './src/games/types'
import { showAlert } from './src/lib/alerts'
import { parseRoomDeepLink } from './src/lib/deepLink'
import { openKakaoTaxi, storeUrl, type TaxiLaunchResult } from './src/lib/kakaoTaxi'
import { setSoundEnabled, useAppSound, useBackgroundMusic } from './src/sound'
import {
  clearStoredRoomCode,
  getStoredNickname,
  getStoredRoomCode,
  setStoredNickname,
  setStoredRoomCode,
} from './src/lib/localProfile'
import { supabase } from './src/lib/supabase'
import { checkRoom, createRoom, ensureAnonymousSession, joinRoom, leaveRoom, leaveRoomBeacon, rejoinRoom, RoomError, setSessionPeriod } from './src/room/api'
import { listAllRoomPlayersEver, listPlayers, subscribeToPlayers } from './src/room/players'
import { joinRoomPresence, type PresenceHandle } from './src/room/presence'
import { listSessionScores, waitForAllScores } from './src/room/scores'
import {
  getActiveSession,
  getNextSessionDueAt,
  subscribeActiveSession,
  subscribeSessionStart,
  waitBeforeBounce,
  type ActiveSession,
} from './src/room/sessions'
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

/**
 * 배경음이 흐르는 화면.
 *
 * 세션이 도는 동안(공개 → 카운트다운 → 게임 → 결과)은 뺀다. 그 구간의 소리는
 * 장식이 아니라 신호다 — 시작 알림을 놓치면 판이 그냥 지나가고 0점으로 강퇴되고
 * (webDistribution.md §1.2), 게임 안에서는 초당 일곱 번씩 나는 타격음으로 잘
 * 맞췄는지를 판단한다. 배경음이 그 위에 깔리면 둘 다 흐려진다.
 *
 * 그래서 배경음은 "기다리는 동안"만 흐른다. 술자리에서 실제로 떠들고 있는 구간이다.
 * 설정 화면을 넣어둔 건 토글을 누르는 순간 바뀌는 게 들려야 하기 때문이다.
 */
const MUSIC_SCREENS: readonly ScreenName[] = [
  'Home',
  'RoomSetup',
  'CreateRoom',
  'JoinRoom',
  'Lobby',
  'NextSessionWait',
  'Settings',
]

/** remainingMs가 0 이하면 null(=주기 도달, 배지로 전환). 아니면 "분:초" */
function formatCountdown(remainingMs: number): string | null {
  if (remainingMs <= 0) return null
  const totalSec = Math.ceil(remainingMs / 1000)
  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

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
  const appSound = useAppSound()

  // 설정을 끄면 앱 전체가 조용해진다. 게임 10종이 각자 지킬 필요가 없다.
  useEffect(() => {
    setSoundEnabled(soundEffectsEnabled)
  }, [soundEffectsEnabled])

  const [backgroundMusicEnabled, setBackgroundMusicEnabled] = useState(true)

  // 기다리는 화면에서만 흐른다. 세션이 도는 동안은 소리가 신호라 비켜준다.
  useBackgroundMusic(backgroundMusicEnabled && MUSIC_SCREENS.includes(screen))

  const [launch, setLaunch] = useState<TaxiLaunchResult | null>(null)
  /** GoingHome이 벌칙(집 가)인지 자발적 귀가(집에 갈래)인지 — 문구만 다르고 경로는 같다 */
  const [goingHomeReason, setGoingHomeReason] = useState<'penalty' | 'voluntary'>('penalty')
  /** CreateRoom의 뒤로가기가 어디로 돌아갈지. Home에서 새로 만들 때와 Lobby에서 재초대할 때가 다르다 */
  const [createRoomOrigin, setCreateRoomOrigin] = useState<'Home' | 'Lobby'>('Home')
  /** 설정에서 뒤로가기가 어디로 돌아갈지. 예전엔 무조건 Home으로 갔는데, 게임 도중
   * 설정을 눌렀다가 나오면 메인으로 튕겨나가는 버그였다 — 들어온 화면을 기억해뒀다 그대로 돌려준다. */
  const [settingsOrigin, setSettingsOrigin] = useState<ScreenName>('Home')

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
  /** 이 방에 지금 진행 중인(끝나지 않은) 세션. S11 대기 화면 라우팅에만 쓴다 */
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  /** 다음 세션 "슬슬 할 때" 알림 기준 시각(ms epoch). 로비 배지·카운트다운 표시용 */
  const [nextSessionDueAtMs, setNextSessionDueAtMs] = useState<number | null>(null)
  /** 로비에 떠 있는 동안만 1초마다 갱신 — 카운트다운 텍스트 재계산 트리거 */
  const [lobbyNowMs, setLobbyNowMs] = useState(() => Date.now())
  /** 이 방에 지금 접속 중인 플레이어 id들 (Supabase Presence). players 테이블의
   * "방 소속 여부"와는 별개로 "화면을 보고 있나"만 나타낸다. */
  const [onlinePlayerIds, setOnlinePlayerIds] = useState<Set<string>>(new Set())
  /** 방장을 제외한 인원 중 "게임 시작" 준비를 마친 사람들 (Presence, §presence.ts). */
  const [readyPlayerIds, setReadyPlayerIds] = useState<Set<string>>(new Set())
  const presenceHandleRef = useRef<PresenceHandle | null>(null)

  const [nicknameSheetVisible, setNicknameSheetVisible] = useState(false)
  const pendingAfterNicknameRef = useRef<((nickname: string) => void) | null>(null)
  const initialDeepLinkHandledRef = useRef(false)

  // 폰 시계가 아니라 서버 보정 시각 기준으로 카운트다운을 맞춘다 (한 번 만들어 계속 쓴다)
  const clockRef = useRef(
    createClock({ fetchServerNowMs: () => serverNowMs(sessionRpcClient), localNowMs: () => Date.now() }),
  )
  /** 세션이 시작되는 순간의 방 참가자 id 스냅샷. end_session을 부르기 전에 이
   * 사람들이 3판을 다 냈는지 기다리는 데 쓴다(useSession의 END_SESSION_WAIT_MS) —
   * ref라서 sessionDeps가 lobbyPlayers 변화마다 다시 안 만들어진다. */
  const sessionRosterRef = useRef<string[]>([])

  const sessionDeps = useMemo(
    () => ({
      client: sessionRpcClient,
      clock: clockRef.current,
      subscribeSessionStart: (cb: Parameters<typeof subscribeSessionStart>[1]) =>
        roomId ? subscribeSessionStart(roomId, cb) : () => {},
      getSessionParticipantIds: () => sessionRosterRef.current,
      waitForAllScores,
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

  // 방에 들어와 있는 동안 "나 지금 접속 중"을 Presence로 알리고, 남들의 접속 상태도 받는다
  // (mdfile/집가_설계정리.md §3.3, 프론트엔드_화면명세.md S1 실시간 인원 카운트).
  useEffect(() => {
    if (!roomId || !myPlayerId || !nickname) {
      setOnlinePlayerIds(new Set())
      setReadyPlayerIds(new Set())
      presenceHandleRef.current = null
      return
    }
    const handle = joinRoomPresence(roomId, { playerId: myPlayerId, nickname }, (presence) => {
      setOnlinePlayerIds(presence.onlinePlayerIds)
      setReadyPlayerIds(presence.readyPlayerIds)
    })
    presenceHandleRef.current = handle
    return () => {
      presenceHandleRef.current = null
      handle.unsubscribe()
    }
  }, [roomId, myPlayerId, nickname])

  /** 대기중 → 준비완료. 한 방향뿐이다 — 되돌리는 버튼은 없다. */
  const handleReady = useCallback(() => {
    presenceHandleRef.current?.setReady(true)
  }, [])

  // 방장 승계 알림. lobbyPlayers가 이 방에서 처음 채워진 스냅샷은 기준값으로만 잡고
  // (방금 만들었든 막 들어왔든, 그 시점의 방장 여부는 "승계"가 아니다) 그 이후에
  // false -> true로 바뀔 때만 "네가 방장이 됐다"고 알린다.
  const hostBaselineRef = useRef<{ roomId: string | null; wasHost: boolean }>({
    roomId: null,
    wasHost: false,
  })
  useEffect(() => {
    if (!roomId || lobbyPlayers.length === 0) return

    const amHostNow = lobbyPlayers.some((p) => p.isHost && p.id === myPlayerId)
    const baseline = hostBaselineRef.current

    if (baseline.roomId !== roomId) {
      hostBaselineRef.current = { roomId, wasHost: amHostNow }
      return
    }

    if (amHostNow && !baseline.wasHost) {
      showAlert({
        title: '방장이 되었어요',
        text: '이전 방장이 방을 나가서 방장 권한을 넘겨받았어요.',
        icon: 'info',
      })
    }
    hostBaselineRef.current = { roomId, wasHost: amHostNow }
  }, [roomId, myPlayerId, lobbyPlayers])

  // 이 방에 지금 진행 중인 세션이 있는지 계속 최신으로 들고 있는다. 세션 도중에 새로
  // 입장·재입장한 사람을 로비 대신 대기 화면(S11)으로 돌리는 데만 쓴다.
  useEffect(() => {
    if (!roomId) {
      setActiveSession(null)
      return
    }
    getActiveSession(roomId).then(setActiveSession).catch(() => {})
    return subscribeActiveSession(roomId, setActiveSession)
  }, [roomId])

  // 복귀 동기화 — 탭이 숨겨져 있던 동안 온 Realtime 신호는 이미 지나갔다. 다시 보이면
  // 즉시 재조회한다. 안 하면 "화장실 다녀오는 사이 세션이 열렸다 끝나서 평균 0점으로
  // 강퇴"가 그대로 남는다 (webDistribution.md §C.1 — "가장 중요하다").
  useEffect(() => {
    if (!roomId || Platform.OS !== 'web' || typeof document === 'undefined') return

    function onVisibilityChange() {
      if (document.visibilityState !== 'visible' || !roomId) return
      getActiveSession(roomId).then(setActiveSession).catch(() => {})
      listPlayers(roomId).then(setLobbyPlayers).catch(() => {})
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [roomId])

  // 탭을 닫으면(새로고침·다른 주소로 이동 포함) 그 방에서 나간 것으로 친다 —
  // 방 코드도 지워서 다음에 열었을 때 "재입장" 안내가 안 뜨고 깨끗한 Home이다.
  // pagehide는 beforeunload와 달리 모바일 브라우저에서도 안정적으로 온다.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return

    function onPageHide() {
      if (!roomId) return
      leaveRoomBeacon()
      clearStoredRoomCode()
    }

    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [roomId])

  // 로비에 들어올 때마다(입장 직후·재입장·세션 종료 후 복귀) 다음 세션 알림 기준
  // 시각과 참가자 목록(누적 평균·순위 포함)을 다시 읽는다 — 직전 세션이 막 끝났으면
  // ended_at·scores가 갱신돼 있어야 하는데, players 테이블 자체는 안 바뀌어서
  // subscribeToPlayers만으로는 이 갱신을 못 잡는다.
  useEffect(() => {
    if (screen !== 'Lobby' || !roomId) return
    // 다음 판을 위해 준비 상태를 되돌린다 — 방금 세션이 끝나고 막 돌아온 참이든
    // 방금 입장했든, 여기서는 항상 "아직 준비 안 함"이 맞다.
    presenceHandleRef.current?.setReady(false)
    let cancelled = false
    getNextSessionDueAt(roomId)
      .then((ms) => {
        if (!cancelled) setNextSessionDueAtMs(ms)
      })
      .catch(() => {})
    listPlayers(roomId)
      .then((players) => {
        if (!cancelled) setLobbyPlayers(players)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [screen, roomId])

  // 로비에 떠 있는 동안만 카운트다운 텍스트를 1초마다 다시 계산한다
  useEffect(() => {
    if (screen !== 'Lobby') return
    const id = setInterval(() => setLobbyNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [screen])

  // 세션이 시작되면(방장이 눌렀든, 참가자로서 Realtime으로 알게 됐든) 로비를 벗어나
  // 게임 3개 공개(S4)로 넘어간다. 그 뒤 단계는 각 화면의 onDone이 직접 넘긴다.
  useEffect(() => {
    if (screen === 'Lobby' && session.state?.phase === 'lineup') {
      setFallbackResultPlayers(null) // 지난 세션의 잔여 결과를 지운다
      // 지금 이 순간의 참가자를 스냅샷으로 남긴다 — 세션 끝날 때 이 사람들이
      // 3판을 다 냈는지 기다리는 기준이 된다(useSession의 waitForAllScores).
      sessionRosterRef.current = lobbyPlayers.map((p) => p.id)
      // 폰을 안 보고 있으면 판이 그냥 지나가고 3판 평균 0점으로 강퇴된다.
      // 이 소리가 그 구멍을 메운다 (webDistribution.md §1.2).
      appSound.sessionStart()
      setScreen('GameReveal')
    }
  }, [screen, session.state])

  // 이미 진행 중인 세션의 sessions INSERT는 놓쳤으므로(subscribeSessionStart는 그 이후의
  // INSERT만 본다) session.state가 안 채워진다 — 그런 사람은 로비 대신 대기 화면으로 보낸다.
  // (mdfile/프론트엔드_화면명세.md S11 — "세션 도중 입장·재입장한 사람은 끼지 않는다")
  //
  // 다만 바로 판단하면 안 된다. 이 신호(subscribeActiveSession)와 합류 신호
  // (subscribeSessionStart)는 같은 INSERT를 서로 다른 채널로 듣기 때문에 도착
  // 순서가 보장되지 않는다. 이 신호가 먼저 오면 "세션은 있는데 나는 아직 합류를
  // 못 했다"는 상태가 잠깐 생기는데, 그걸 늦게 들어온 사람으로 오해하면 같이
  // 시작한 사람이 통째로 대기 화면에 갇힌다 — 세션이 끝나야 빠져나온다.
  //
  // 그래서 시작 시각 기준으로 유예를 두고, 그 사이에 합류 신호가 오면
  // session.state가 채워지면서 이 effect가 다시 돌아 타이머를 걷어간다.
  useEffect(() => {
    if (screen !== 'Lobby' || activeSession === null || session.state !== null) return

    const waitMs = waitBeforeBounce(activeSession.startsAt, clockRef.current.now())
    const timer = setTimeout(() => setScreen('NextSessionWait'), waitMs)
    return () => clearTimeout(timer)
  }, [screen, activeSession, session.state])

  // 대기 중이던 세션이 끝나면(activeSession이 null이 되면) 자동으로 로비로 돌아간다.
  useEffect(() => {
    if (screen === 'NextSessionWait' && activeSession === null) {
      setScreen('Lobby')
    }
  }, [screen, activeSession])

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
      // 주소창은 일부러 안 지운다 — 새로고침해도 같은 방으로 다시 들어가는 게
      // 오히려 이득이다 (webDistribution.md §A.2). join_room 자체가 멱등이라 안전하다.
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
  /** 설정 화면을 열면서 지금 화면을 기억해둔다 — 뒤로가기가 그리로 돌아간다. */
  function openSettings() {
    setSettingsOrigin(screen)
    setScreen('Settings')
  }

  /**
   * 방을 만들거나 들어가기 직전에 항상 닉네임 시트를 띄운다. 저장된 닉네임이
   * 있으면 프리필만 하고(확인 한 번이면 되니 사실상 원터치), 그렇다고 시트 자체를
   * 건너뛰면 안 된다 — 건너뛰면 한 번 정한 닉네임을 영영 못 바꾸게 된다
   * (mdfile/frontend.md §4.0 "프리필한다"이지 "생략한다"가 아니다).
   */
  function requireNickname(action: (nickname: string) => void) {
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
      // 방장이자 방 안에 있어야 통과하므로 create_room 다음에 부른다 (백엔드 §5.10).
      // 실패해도 방은 이미 만들어졌다 — 기본값 30분으로 두고 넘어간다.
      try {
        await setSessionPeriod(intervalMinutes)
      } catch (err) {
        console.warn('set_session_period 실패', err)
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
      const { roomId: targetRoomId } = await checkRoom(code)
      setJoinLoading(false)
      requireNickname(async (nick) => {
        await warnIfNicknameTaken(targetRoomId, nick)
        handleSubmitJoinCode(code, nick)
      })
    } catch (e) {
      setJoinLoading(false)
      setJoinError(roomErrorMessage(e))
    }
  }

  /**
   * 닉네임 중복은 서버가 막지 않는다(백엔드_Supabase명세.md §4.0 주석) — 헷갈릴 수
   * 있으니 클라이언트가 경고만 띄운다. 입장을 막지는 않는다.
   */
  async function warnIfNicknameTaken(targetRoomId: string, nick: string) {
    try {
      const existing = await listPlayers(targetRoomId)
      const taken = existing.some((p) => p.nickname.trim().toLowerCase() === nick.trim().toLowerCase())
      if (taken) {
        await showAlert({
          title: '이미 있는 닉네임이에요',
          text: `"${nick}" 이름을 쓰는 사람이 이 방에 이미 있어요. 헷갈릴 수 있어요.`,
          icon: 'warning',
        })
      }
    } catch (e) {
      console.warn('닉네임 중복 확인 실패', e)
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
        // S0 명세: "방이 이미 소멸 → 안내 후 로컬 코드 삭제, S0 유지". Home에서 부르면
        // 이미 Home이라 no-op이지만, GoingHome의 "아직 안 갈래"에서 부르면 이게 없으면
        // 실패 후에도 GoingHome에 그대로 갇힌다.
        setScreen('Home')
      }
    }
  }

  /**
   * GoingHome의 "첫 화면으로". 이 시점엔 이미 방에서 나간 상태라 서버에 더
   * 할 일은 없다 — "아직 안 갈래"(rejoin_room)와 반대로, 이 방 코드를 완전히
   * 접고 Home으로 돌아간다(handleRejoin 실패 경로와 같은 정리).
   */
  async function handleGoHomeFromGoingHome() {
    await clearStoredRoomCode()
    setStoredRoomCodeState(null)
    setActiveRoomCode(null)
    setRoomId(null)
    setMyPlayerId(null)
    setScreen('Home')
  }

  /**
   * "집에 갈래" — 벌칙과 완전히 같은 경로를 탄다: 서버 제거 커밋(leave_room) →
   * 응답 확인 → 카카오T 딥링크 (sessionEnd.md §4.3, §4.2 순서 경고).
   * 딥링크를 먼저 쏘면 앱이 백그라운드로 내려가면서 leave_room 요청이 유실될 수 있다.
   *
   * 방 코드는 로컬에 그대로 둔다 — S10 명세: "아직 안 갈래"가 이 코드로 복귀한다.
   * storedRoomCode를 지우는 건 방이 실제로 사라졌을 때(handleRejoin)뿐이다.
   */
  async function handleLeaveRoom() {
    try {
      await leaveRoom()
    } catch (e) {
      console.warn('leave_room 실패', e)
    }
    setActiveRoomCode(null)
    setRoomId(null)
    setMyPlayerId(null)
    setGoingHomeReason('voluntary')
    setLaunch(null)
    setScreen('GoingHome')
    setLaunch(await openKakaoTaxi())
  }

  /** 벌칙 카운트다운이 끝나면 카카오T를 띄우고 귀가 화면으로 넘어간다. */
  const callTaxi = async () => {
    setGoingHomeReason('penalty')
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
    appSound.go()
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

  // lobbyPlayers[0]이 항상 방장인 건 아니다 — 방장 강퇴 시 세션 1등에게 승계되면서
  // 입장 순서와 host_player_id가 어긋날 수 있다. 반드시 isHost 필드로 판단한다.
  const isHost = lobbyPlayers.some((p) => p.isHost && p.id === myPlayerId)
  // 서버 응답과 무관하게 항상 확정되는 내 3판 평균. final 이전엔 null이라 0으로 방어한다
  // (SessionResult는 phase==='final'일 때만 렌더링되므로 실제로는 항상 값이 있다).
  const myAverage = (session.state && sessionAverage(session.state)) ?? 0
  // 순수 알림용 카운트다운 — 주기가 찼으면 null을 줘서 Lobby가 배지로 바꿔 보여준다.
  // 시작 버튼은 이 값과 무관하게 항상 눌린다(canStart만 본다).
  const nextSessionLabel =
    nextSessionDueAtMs === null ? null : formatCountdown(nextSessionDueAtMs - lobbyNowMs)

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
          onSettings={openSettings}
        />
      )}
      {screen === 'RoomSetup' && (
        <RoomSetup
          onBack={() => setScreen('Home')}
          onSettings={openSettings}
          onNext={(intervalMinutes) => {
            handleRoomSetupNext(intervalMinutes)
          }}
        />
      )}
      {screen === 'CreateRoom' && (
        <CreateRoom
          roomCode={creatingRoom ? null : activeRoomCode}
          onlineCount={onlinePlayerIds.size}
          errorMessage={createRoomError}
          onBack={() => setScreen(createRoomOrigin)}
          onSettings={openSettings}
          onDone={createRoomOrigin === 'Home' ? () => setScreen('Lobby') : undefined}
        />
      )}
      {screen === 'JoinRoom' && (
        <JoinRoom
          onBack={() => setScreen('Home')}
          onSettings={openSettings}
          onSubmitCode={handleCheckAndJoin}
          loading={joinLoading}
          errorMessage={joinError}
        />
      )}
      {screen === 'Lobby' && (
        <Lobby
          players={lobbyPlayers}
          myPlayerId={myPlayerId ?? ''}
          onlinePlayerIds={onlinePlayerIds}
          readyPlayerIds={readyPlayerIds}
          onReady={handleReady}
          threshold={40}
          isHost={isHost}
          nextSessionLabel={nextSessionLabel}
          canStart={
            lobbyPlayers.length >= 2 &&
            lobbyPlayers.filter((p) => !p.isHost).every((p) => readyPlayerIds.has(p.id))
          }
          onStartSession={() => session.start()}
          onLeaveRoom={handleLeaveRoom}
          onSettings={openSettings}
          onShowInviteQr={() => {
            setCreateRoomOrigin('Lobby')
            setScreen('CreateRoom')
          }}
        />
      )}
      {screen === 'NextSessionWait' && (
        <NextSessionWait onSettings={openSettings} onLeaveRoom={handleLeaveRoom} />
      )}
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
          onSettings={openSettings}
          onCallTaxi={callTaxi}
          onBackToLobby={() => setScreen('Lobby')}
        />
      )}
      {screen === 'GoingHome' && (
        <GoingHome
          reason={goingHomeReason}
          launch={launch}
          onSettings={openSettings}
          onOpenStore={() => {
            // 스킴은 이미 실패했다. 다시 시도하지 않고 스토어로 바로 보낸다.
            // iOS에 플레이스토어 링크를 주면 열리기만 하고 설치가 안 된다.
            Linking.openURL(storeUrl()).catch(() => {})
          }}
          // 이 시점엔 이미 방에서 나간 상태(roomId=null)라 그냥 화면 전환이 아니라
          // 진짜 재입장(rejoin_room)이 필요하다 — handleRejoin이 storedRoomCode로 처리한다.
          onStay={handleRejoin}
          onGoHome={handleGoHomeFromGoingHome}
        />
      )}
      {screen === 'Game' && <GameSandbox onSettings={openSettings} onGoHome={() => setScreen('Home')} />}
      {screen === 'Settings' && (
        <Settings
          soundEffectsEnabled={soundEffectsEnabled}
          backgroundMusicEnabled={backgroundMusicEnabled}
          onToggleSoundEffects={setSoundEffectsEnabled}
          onToggleBackgroundMusic={setBackgroundMusicEnabled}
          onBack={() => setScreen(settingsOrigin)}
          onOpenSandbox={() => setScreen('Game')}
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
    </View>
  )
}
