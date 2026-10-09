export interface HouseHistoryEntry {
  trackId: string;
  playedAt: string;
}

export function pickHouseTrack(
  history: HouseHistoryEntry[],
  excludeTrackId: string | null
): string | null {
  if (history.length === 0) {
    return null;
  }

  const latestByTrack = new Map<string, string>();
  for (const { trackId, playedAt } of history) {
    const prev = latestByTrack.get(trackId);
    if (prev === undefined || playedAt > prev) {
      latestByTrack.set(trackId, playedAt);
    }
  }

  const entries = [...latestByTrack.entries()];
  const candidates =
    excludeTrackId === null
      ? entries
      : entries.filter(([id]) => id !== excludeTrackId);

  if (candidates.length === 0) {
    if (excludeTrackId !== null && latestByTrack.has(excludeTrackId)) {
      return excludeTrackId;
    }
    return null;
  }

  candidates.sort((a, b) => {
    const byTime = a[1].localeCompare(b[1]);
    if (byTime !== 0) return byTime;
    return a[0].localeCompare(b[0]);
  });

  return candidates[0][0];
}
