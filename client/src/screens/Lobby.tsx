import { FlatList, StyleSheet, Text, View } from 'react-native'
import { PillButton } from '../components/PillButton'
import { ScreenHeader } from '../components/ScreenHeader'
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
  /** 앱 전역 상수. games/types.ts의 PENALTY_THRESHOLD와 항상 같아야 한다. */
  threshold: number
  /** 이 기기 사용자가 방장인지 */
  isHost: boolean
  /** 다음 게임 시작까지 남은 시간 텍스트. 주기 도달 시 null로 주고 배지를 띄운다 */
  nextSessionLabel: string | null
  /** 시간과 무관한 시작 조건 (예: 최소 인원 2명). 시간 미도달 시(nextSessionLabel !== null) 시작 버튼은 이 값과 무관하게 비활성화된다 */
  canStart: boolean
  onStartSession: () => void
  onLeaveRoom: () => void
  onSettings: () => void
  /** QR 아이콘을 눌렀을 때. 초대 QR을 다시 띄워 새 인원을 받는다 */
  onShowInviteQr: () => void
}

export function Lobby({
  players,
  threshold,
  isHost,
  nextSessionLabel,
  canStart,
  onStartSession,
  onLeaveRoom,
  onSettings,
  onShowInviteQr,
}: LobbyProps) {
  return (
    <View style={styles.screen}>
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
              <PlayerRow player={item} penalized={item.avgScore < threshold} />
            </View>
          )
        }}
      />

      <View style={styles.buttons}>
        {isHost && (
          <PillButton
            label="게임 시작"
            variant="secondary"
            disabled={!canStart || nextSessionLabel !== null}
            onPress={onStartSession}
          />
        )}
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

function PlayerRow({ player, penalized }: { player: LobbyPlayer; penalized: boolean }) {
  const delta = rankDelta(player.rank, player.previousRank)
  return (
    <View style={[styles.row, penalized && styles.rowPenalized]}>
      <View style={styles.leftGroup}>
        <View style={styles.rankBadge}>
          <Text style={styles.rankText}>{player.rank}</Text>
        </View>
        <Text style={[styles.name, penalized && styles.nameOnColor]} numberOfLines={1}>
          {player.nickname}
          {player.isHost ? ' 👑' : ''}
        </Text>
        <Text style={[styles.deltaIcon, penalized && styles.deltaIconOnColor]}>{deltaIcon(delta)}</Text>
      </View>
      <Text style={[styles.score, penalized && styles.scoreOnColor]}>{player.avgScore.toFixed(0)}</Text>
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
