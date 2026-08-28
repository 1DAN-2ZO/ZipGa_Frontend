import { FlatList, StyleSheet, Text, View } from 'react-native'
import { PillButton } from '../components/PillButton'
import { ScreenHeader } from '../components/ScreenHeader'
import { Watermark } from '../components/Watermark'
import { colors, fonts, radius } from '../theme/colors'
import { rankDelta } from './lobbyRank'

export interface LobbyPlayer {
  id: string
  nickname: string
  isHost: boolean
  /** 지금까지 진행된 세션들의 평균 정규화 점수. 0~100 */
  avgScore: number
  rank: number
  /** 직전 세션 순위. 이번 방에서 처음 순위가 매겨졌다면 undefined */
  previousRank?: number
}

export interface LobbyProps {
  players: LobbyPlayer[]
  /** 이 기기 사용자 자신의 id. 목록에서 내 행을 보라색으로 눈에 띄게 표시하는 데 쓴다. */
  myPlayerId: string
  /** 지금 이 방에 접속 중인 플레이어 id들 (Supabase Presence). 화면 표시(초록 점)에만 쓴다 —
   * 방 소속 여부(강퇴·나감) 판단에는 절대 안 쓴다, 그건 players 목록 자체가 이미 반영한다. */
  onlinePlayerIds: Set<string>
  /** 방장을 제외한 인원 중 "게임 시작" 준비를 마친 사람들 (Supabase Presence). */
  readyPlayerIds: Set<string>
  /** 내 준비 상태를 "준비완료"로 바꾼다. 대기중→준비완료 한 방향뿐이라 인자가 없다. */
  onReady: () => void
  /** 앱 전역 상수. games/types.ts의 PENALTY_THRESHOLD와 항상 같아야 한다. */
  threshold: number
  /** 이 기기 사용자가 방장인지 */
  isHost: boolean
  /**
   * 다음 게임 시작까지 남은 시간 텍스트. 주기 도달 시 null로 주고 배지를 띄운다.
   * 순수 알림용이다 — "슬슬 게임 한 번 해라" 정도. 시작 버튼을 막지 않는다.
   */
  nextSessionLabel: string | null
  /** 시작 버튼을 누를 수 있는 조건 (최소 인원 2명 + 방장 제외 전원 준비완료).
   * 주기 도달 여부와는 무관하다(mdfile/프론트엔드_화면명세.md S3 — "주기 도달 전에도
   * 누를 수 있음") — App.tsx가 계산해서 넘긴다. */
  canStart: boolean
  onStartSession: () => void
  /** 방은 그대로 두고 첫 화면으로만 나간다. 방 참여 상태는 유지된다(홈의 "방 재입장"으로 돌아올 수 있다). */
  onGoHome: () => void
  onLeaveRoom: () => void
  onSettings: () => void
  /** QR 아이콘을 눌렀을 때. 초대 QR을 다시 띄워 새 인원을 받는다 */
  onShowInviteQr: () => void
}

export function Lobby({
  players,
  myPlayerId,
  onlinePlayerIds,
  readyPlayerIds,
  onReady,
  threshold,
  isHost,
  nextSessionLabel,
  canStart,
  onStartSession,
  onGoHome,
  onLeaveRoom,
  onSettings,
  onShowInviteQr,
}: LobbyProps) {
  return (
    <View style={styles.screen}>
      <Watermark />
      <ScreenHeader
        title="ZipGa"
        leadingIcon="qr-code-2"
        onLeadingIconPress={onShowInviteQr}
        onSettings={onSettings}
      />

      <View style={styles.timerRow}>
        {nextSessionLabel ? (
          <Text style={styles.timerText}>다음 게임 시작까지 {nextSessionLabel}</Text>
        ) : (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>게임할 시간!</Text>
          </View>
        )}
      </View>

      <FlatList
        data={players}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => {
          const prev = players[index - 1]
          const showDivider = !!prev && prev.avgScore >= threshold && item.avgScore < threshold
          return (
            <View>
              {showDivider && <ThresholdDivider threshold={threshold} />}
              <PlayerRow
                player={item}
                penalized={item.avgScore < threshold}
                online={onlinePlayerIds.has(item.id)}
                isMe={item.id === myPlayerId}
                ready={readyPlayerIds.has(item.id)}
              />
            </View>
          )
        }}
      />

      <View style={styles.buttons}>
        {isHost && (
          <PillButton
            label="게임 시작"
            variant="secondary"
            disabled={!canStart}
            onPress={onStartSession}
          />
        )}
        {!isHost && (
          <PillButton
            testID="ready-button"
            label={readyPlayerIds.has(myPlayerId) ? '게임 대기 중' : '준비'}
            variant="secondary"
            disabled={readyPlayerIds.has(myPlayerId)}
            onPress={onReady}
          />
        )}
        <PillButton label="첫 화면으로" variant="secondary" icon="home" onPress={onGoHome} />
        <PillButton label="집에 갈래" onPress={onLeaveRoom} />
      </View>
    </View>
  )
}

function ThresholdDivider({ threshold }: { threshold: number }) {
  return (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>기준선 {threshold}점</Text>
      <View style={styles.dividerLine} />
    </View>
  )
}

function PlayerRow({
  player,
  penalized,
  online,
  isMe,
  ready,
}: {
  player: LobbyPlayer
  penalized: boolean
  /** Presence 기준 접속 여부. 끊겼다고 방에서 나간 건 아니다 — 그냥 흐리게만 표시한다 */
  online: boolean
  /** 이 행이 나 자신인지. 보라 배경으로 눈에 띄게 한다 — 탈락 배경과 같은 색이라 글자색도 같이 맞춘다. */
  isMe: boolean
  /** 방장을 제외한 인원의 준비 여부. 방장 행은 애초에 안 쓴다. */
  ready: boolean
}) {
  const delta = rankDelta(player.rank, player.previousRank)
  const onColor = penalized || isMe
  return (
    <View style={[styles.row, onColor && styles.rowPenalized]}>
      <View style={styles.leftGroup}>
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>{player.rank}</Text>
        </View>
        <View style={[styles.onlineDot, online ? styles.onlineDotOn : styles.onlineDotOff]} />
        <Text style={[styles.name, onColor && styles.nameOnColor]} numberOfLines={1}>
          {player.nickname}
          {player.isHost ? ' 👑' : ''}
        </Text>
        <Text style={[styles.deltaIcon, onColor && styles.deltaIconOnColor]}>{deltaIcon(delta)}</Text>
      </View>
      {/* 여기는 표시 전용이다 — 본인 준비 상태를 실제로 바꾸는 버튼은 화면 하단,
          "게임 시작"과 같은 자리에 있다(App.tsx의 handleReady, 아래 buttons). */}
      {!player.isHost && (
        <View style={[styles.readyBadge, ready ? styles.readyBadgeDone : styles.readyBadgeWaiting]}>
          <Text style={ready ? styles.readyBadgeTextDone : styles.readyBadgeText}>
            {ready ? '준비완료' : '대기중'}
          </Text>
        </View>
      )}
      <Text style={[styles.score, onColor && styles.scoreOnColor]}>{player.avgScore.toFixed(0)}점</Text>
    </View>
  )
}

function deltaIcon(delta: ReturnType<typeof rankDelta>): string {
  if (delta === 'up') return '▲'
  if (delta === 'down') return '▼'
  if (delta === 'same') return '-'
  return ''
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  timerRow: {
    alignItems: 'center',
    marginTop: 16,
  },
  timerText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    color: colors.textSecondary,
  },
  badge: {
    backgroundColor: colors.secondary,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: colors.textPrimary,
  },
  list: {
    gap: 10,
    paddingVertical: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  rowPenalized: {
    backgroundColor: colors.primary,
  },
  leftGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  onlineDotOn: {
    backgroundColor: colors.online,
  },
  onlineDotOff: {
    backgroundColor: colors.divider,
  },
  name: {
    flexShrink: 1,
    fontFamily: fonts.semibold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  nameOnColor: {
    color: colors.white,
  },
  deltaIcon: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textMuted,
  },
  deltaIconOnColor: {
    color: 'rgba(255,255,255,0.85)',
  },
  readyBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  readyBadgeWaiting: {
    backgroundColor: colors.inputBg,
  },
  readyBadgeText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.textMuted,
  },
  readyBadgeDone: {
    backgroundColor: colors.good,
  },
  readyBadgeTextDone: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.white,
  },
  score: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.primary,
  },
  scoreOnColor: {
    color: colors.white,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.primary,
    opacity: 0.4,
  },
  dividerText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: colors.primary,
  },
  buttons: {
    gap: 12,
    paddingBottom: 32,
  },
})
