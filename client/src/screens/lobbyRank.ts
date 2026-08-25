export type RankDelta = 'up' | 'down' | 'same' | 'new'

/** 직전 세션 순위 대비 변동. previousRank가 없으면(첫 세션 참가) 'new'다. */
export function rankDelta(rank: number, previousRank?: number): RankDelta {
  if (previousRank === undefined) return 'new'
  if (rank < previousRank) return 'up'
  if (rank > previousRank) return 'down'
  return 'same'
}
