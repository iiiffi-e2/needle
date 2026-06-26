export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  channelTitle: string;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

const queryCache = new Map<
  string,
  { results: YouTubeSearchResult[]; expiresAt: number }
>();

const rateLimitBuckets = new Map<string, number[]>();

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function getCachedSearchResults(
  query: string
): YouTubeSearchResult[] | null {
  const key = normalizeQuery(query);
  const entry = queryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    queryCache.delete(key);
    return null;
  }
  return entry.results;
}

export function setCachedSearchResults(
  query: string,
  results: YouTubeSearchResult[]
): void {
  const key = normalizeQuery(query);
  queryCache.set(key, {
    results,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function checkSearchRateLimit(userId: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (rateLimitBuckets.get(userId) ?? []).filter(
    (t) => t > windowStart
  );
  if (timestamps.length >= RATE_LIMIT_MAX) {
    rateLimitBuckets.set(userId, timestamps);
    return false;
  }
  timestamps.push(now);
  rateLimitBuckets.set(userId, timestamps);
  return true;
}
