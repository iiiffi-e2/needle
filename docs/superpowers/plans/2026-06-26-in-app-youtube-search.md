# In-App YouTube Track Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let DJs and listeners search YouTube and drop/save tracks without leaving Needle, via a unified smart input in the drop bar and a Browse sub-tab in the Crate.

**Architecture:** Server-side YouTube Data API v3 search (`GET /api/youtube/search`) with in-memory cache and rate limiting; shared `findOrCreateYouTubeTrack` helper for track rows; reusable `TrackSearchInput` client component wired into drop bar, mobile sheet, and Crate Browse; in-context DJ coach mark via localStorage.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase, YouTube Data API v3, Vitest (unit tests for pure lib code)

**Spec:** `docs/superpowers/specs/2026-06-26-in-app-youtube-search-design.md`

---

## File Map

| File | Responsibility |
|------|----------------|
| `src/lib/youtube-search-cache.ts` | Query cache (1h TTL) + per-user rate limiter |
| `src/lib/youtube.ts` | Existing URL parse/oEmbed + new `searchYouTubeVideos()` |
| `src/lib/find-or-create-youtube-track.ts` | Find or insert `tracks` row by `provider_id` |
| `src/lib/youtube-search-cache.test.ts` | Unit tests for cache/rate limit |
| `src/app/api/youtube/search/route.ts` | Authenticated search endpoint |
| `src/app/api/users/me/crate/route.ts` | Save track to user's crate by URL/videoId |
| `src/components/shared/TrackSearchInput.tsx` | Debounced search dropdown + URL detect |
| `src/components/shared/DjDropHint.tsx` | First-time DJ coach mark |
| `src/components/venue/DropTrackBar.tsx` | Replace plain input with TrackSearchInput |
| `src/components/venue/DropSheet.tsx` | Same for mobile |
| `src/components/venue/RoomSidePanel.tsx` | Crate Saved/Browse sub-tabs |
| `src/app/api/rooms/[slug]/track/route.ts` | Refactor to use `findOrCreateYouTubeTrack` |
| `.env.example` | Add `YOUTUBE_API_KEY` |
| `README.md` | Google Cloud setup instructions |
| `vitest.config.ts` | Vitest + `@/` path alias |

---

### Task 1: Vitest setup

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Add test script to `package.json`**

In the `"scripts"` object, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 4: Verify Vitest runs**

Run: `npm test`
Expected: PASS (0 tests) or no test files found — exit 0

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for unit tests"
```

---

### Task 2: Search cache and rate limiter

**Files:**
- Create: `src/lib/youtube-search-cache.ts`
- Create: `src/lib/youtube-search-cache.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/youtube-search-cache.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getCachedSearchResults,
  setCachedSearchResults,
  checkSearchRateLimit,
  type YouTubeSearchResult,
} from "./youtube-search-cache";

const sample: YouTubeSearchResult[] = [
  {
    videoId: "abc12345678",
    title: "Test Track",
    thumbnailUrl: "https://example.com/thumb.jpg",
    channelTitle: "Test Channel",
  },
];

describe("youtube-search-cache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("returns null for uncached query", () => {
    expect(getCachedSearchResults("never searched")).toBeNull();
  });

  it("returns cached results within TTL", () => {
    setCachedSearchResults("daft punk", sample);
    expect(getCachedSearchResults("daft punk")).toEqual(sample);
  });

  it("expires cache after 1 hour", () => {
    setCachedSearchResults("daft punk", sample);
    vi.advanceTimersByTime(60 * 60 * 1000 + 1);
    expect(getCachedSearchResults("daft punk")).toBeNull();
  });

  it("normalizes query keys (trim + lowercase)", () => {
    setCachedSearchResults("  Daft Punk  ", sample);
    expect(getCachedSearchResults("daft punk")).toEqual(sample);
  });

  it("allows requests under rate limit", () => {
    const userId = "user-1";
    for (let i = 0; i < 20; i++) {
      expect(checkSearchRateLimit(userId)).toBe(true);
    }
  });

  it("blocks requests over rate limit", () => {
    const userId = "user-2";
    for (let i = 0; i < 20; i++) {
      checkSearchRateLimit(userId);
    }
    expect(checkSearchRateLimit(userId)).toBe(false);
  });

  it("resets rate limit after 1 minute", () => {
    const userId = "user-3";
    for (let i = 0; i < 20; i++) {
      checkSearchRateLimit(userId);
    }
    expect(checkSearchRateLimit(userId)).toBe(false);
    vi.advanceTimersByTime(60 * 1000 + 1);
    expect(checkSearchRateLimit(userId)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/youtube-search-cache.test.ts`
Expected: FAIL — module `./youtube-search-cache` not found

- [ ] **Step 3: Implement cache module**

Create `src/lib/youtube-search-cache.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/youtube-search-cache.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/youtube-search-cache.ts src/lib/youtube-search-cache.test.ts
git commit -m "feat: add YouTube search cache and rate limiter"
```

---

### Task 3: YouTube search API helper

**Files:**
- Modify: `src/lib/youtube.ts`

- [ ] **Step 1: Add types and `searchYouTubeVideos` to `src/lib/youtube.ts`**

Append to the file (keep existing exports):

```ts
import type { YouTubeSearchResult } from "./youtube-search-cache";

export type { YouTubeSearchResult };

interface YouTubeSearchApiItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
  };
}

export async function searchYouTubeVideos(
  query: string,
  apiKey: string
): Promise<YouTubeSearchResult[]> {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: "8",
    safeSearch: "moderate",
    q: query.trim(),
    key: apiKey,
  });

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${params.toString()}`
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube search failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { items?: YouTubeSearchApiItem[] };

  return (data.items ?? [])
    .map((item) => {
      const videoId = item.id?.videoId;
      if (!videoId) return null;
      const thumb =
        item.snippet?.thumbnails?.medium?.url ??
        item.snippet?.thumbnails?.default?.url ??
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      return {
        videoId,
        title: item.snippet?.title ?? "Unknown Track",
        thumbnailUrl: thumb,
        channelTitle: item.snippet?.channelTitle ?? "Unknown Channel",
      };
    })
    .filter((r): r is YouTubeSearchResult => r !== null);
}

export function youTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors (or only pre-existing ones unrelated to this file)

- [ ] **Step 3: Commit**

```bash
git add src/lib/youtube.ts
git commit -m "feat: add searchYouTubeVideos helper"
```

---

### Task 4: findOrCreateYouTubeTrack helper

**Files:**
- Create: `src/lib/find-or-create-youtube-track.ts`
- Modify: `src/app/api/rooms/[slug]/track/route.ts`

- [ ] **Step 1: Create helper**

Create `src/lib/find-or-create-youtube-track.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchYouTubeMetadata, youTubeWatchUrl } from "./youtube";
import type { Track } from "./types";

export async function findOrCreateYouTubeTrack(
  admin: SupabaseClient,
  videoId: string,
  submittedBy: string
): Promise<Track> {
  const { data: existing } = await admin
    .from("tracks")
    .select("*")
    .eq("provider", "youtube")
    .eq("provider_id", videoId)
    .maybeSingle();

  if (existing) {
    return existing as Track;
  }

  const metadata = await fetchYouTubeMetadata(videoId);

  const { data: created, error } = await admin
    .from("tracks")
    .insert({
      provider: "youtube",
      provider_id: videoId,
      url: youTubeWatchUrl(videoId),
      title: metadata.title,
      thumbnail_url: metadata.thumbnail_url,
      duration_seconds: metadata.duration_seconds,
      submitted_by: submittedBy,
    })
    .select()
    .single();

  if (error || !created) {
    throw new Error(error?.message ?? "Failed to create track");
  }

  return created as Track;
}
```

- [ ] **Step 2: Refactor track route to use helper**

In `src/app/api/rooms/[slug]/track/route.ts`:

Replace the import line:

```ts
import { parseYouTubeUrl, fetchYouTubeMetadata } from "@/lib/youtube";
```

With:

```ts
import { parseYouTubeUrl } from "@/lib/youtube";
import { findOrCreateYouTubeTrack } from "@/lib/find-or-create-youtube-track";
```

Replace the `else if (url)` block body (lines ~63–91) with:

```ts
  } else if (url) {
    const videoId = parseYouTubeUrl(url);
    if (!videoId) {
      return NextResponse.json(
        { error: "Invalid YouTube URL" },
        { status: 400 }
      );
    }

    try {
      track = await findOrCreateYouTubeTrack(admin, videoId, user.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create track";
      return NextResponse.json({ error: message }, { status: 500 });
    }
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: successful build

- [ ] **Step 4: Commit**

```bash
git add src/lib/find-or-create-youtube-track.ts src/app/api/rooms/[slug]/track/route.ts
git commit -m "refactor: extract findOrCreateYouTubeTrack helper"
```

---

### Task 5: GET /api/youtube/search

**Files:**
- Create: `src/app/api/youtube/search/route.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add env var to `.env.example`**

After the OpenAI block, add:

```
# YouTube Data API v3 (for in-app track search)
YOUTUBE_API_KEY=your-youtube-api-key
```

- [ ] **Step 2: Create search route**

Create `src/app/api/youtube/search/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchYouTubeVideos } from "@/lib/youtube";
import {
  checkSearchRateLimit,
  getCachedSearchResults,
  setCachedSearchResults,
} from "@/lib/youtube-search-cache";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Search unavailable" },
      { status: 503 }
    );
  }

  const cached = getCachedSearchResults(query);
  if (cached) {
    return NextResponse.json({ results: cached, cached: true });
  }

  if (!checkSearchRateLimit(user.id)) {
    return NextResponse.json(
      { error: "Too many searches — wait a moment and try again" },
      { status: 429 }
    );
  }

  try {
    const results = await searchYouTubeVideos(query, apiKey);
    setCachedSearchResults(query, results);
    return NextResponse.json({ results, cached: false });
  } catch (err) {
    console.error("YouTube search error:", err);
    return NextResponse.json(
      { error: "Search unavailable — paste a link instead" },
      { status: 502 }
    );
  }
}
```

- [ ] **Step 3: Manual smoke test**

Run dev server: `npm run dev`

While logged in, open browser devtools and run:

```js
fetch('/api/youtube/search?q=daft+punk').then(r => r.json()).then(console.log)
```

Expected (with `YOUTUBE_API_KEY` set in `.env.local`): `{ results: [...], cached: false }`
Expected (without key): `{ error: "Search unavailable" }` with status 503

- [ ] **Step 4: Commit**

```bash
git add src/app/api/youtube/search/route.ts .env.example
git commit -m "feat: add YouTube search API endpoint"
```

---

### Task 6: POST /api/users/me/crate

**Files:**
- Create: `src/app/api/users/me/crate/route.ts`

- [ ] **Step 1: Create crate save route**

Create `src/app/api/users/me/crate/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { parseYouTubeUrl } from "@/lib/youtube";
import { findOrCreateYouTubeTrack } from "@/lib/find-or-create-youtube-track";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { url, videoId: rawVideoId } = body as {
    url?: string;
    videoId?: string;
  };

  const videoId =
    rawVideoId?.trim() || (url ? parseYouTubeUrl(url) : null);

  if (!videoId) {
    return NextResponse.json(
      { error: "Provide a valid YouTube URL or video ID" },
      { status: 400 }
    );
  }

  const admin = createServiceClient();

  let track;
  try {
    track = await findOrCreateYouTubeTrack(admin, videoId, user.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save track";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data: existingSave } = await admin
    .from("saved_tracks")
    .select("id")
    .eq("user_id", user.id)
    .eq("track_id", track.id)
    .maybeSingle();

  const { error: saveError } = await admin.from("saved_tracks").upsert(
    {
      user_id: user.id,
      track_id: track.id,
      room_id: null,
    },
    { onConflict: "user_id,track_id" }
  );

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  return NextResponse.json({
    saved: true,
    trackId: track.id,
    alreadySaved: Boolean(existingSave),
  });
}
```

- [ ] **Step 2: Manual smoke test**

```js
fetch('/api/users/me/crate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ videoId: 'dQw4w9WgXcQ' })
}).then(r => r.json()).then(console.log)
```

Expected: `{ saved: true, trackId: "...", alreadySaved: false }`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/users/me/crate/route.ts
git commit -m "feat: add save-to-crate API endpoint"
```

---

### Task 7: TrackSearchInput component

**Files:**
- Create: `src/components/shared/TrackSearchInput.tsx`

- [ ] **Step 1: Create component**

Create `src/components/shared/TrackSearchInput.tsx`:

```tsx
"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { parseYouTubeUrl } from "@/lib/youtube";
import type { YouTubeSearchResult } from "@/lib/youtube-search-cache";
import { cn } from "@/lib/utils";

export interface TrackSearchInputProps {
  placeholder?: string;
  disabled?: boolean;
  inputClassName?: string;
  onSelect: (videoId: string, url: string) => void;
  showSaveAction?: boolean;
  onSave?: (videoId: string, url: string) => void;
  isDj?: boolean;
  autoFocus?: boolean;
}

function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function TrackSearchInput({
  placeholder = "Search for a track or paste a YouTube link…",
  disabled = false,
  inputClassName,
  onSelect,
  showSaveAction = false,
  onSave,
  isDj = false,
  autoFocus = false,
}: TrackSearchInputProps) {
  const [value, setValue] = useState("");
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parsedVideoId = value.trim() ? parseYouTubeUrl(value) : null;
  const isUrlMode = Boolean(parsedVideoId);

  const runSearch = useCallback(async (query: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/youtube/search?q=${encodeURIComponent(query)}`
      );
      const data = await res.json();
      if (!res.ok) {
        setResults([]);
        setError(data.error || "Search unavailable");
        setOpen(true);
        return;
      }
      setResults(data.results ?? []);
      setOpen(true);
      setHighlightIndex(data.results?.length ? 0 : -1);
    } catch {
      setResults([]);
      setError("Search unavailable — paste a link instead");
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = value.trim();
    if (!trimmed || trimmed.length < 2) {
      setResults([]);
      setError("");
      setOpen(false);
      return;
    }

    if (parseYouTubeUrl(trimmed)) {
      setResults([]);
      setError("");
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      void runSearch(trimmed);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, runSearch]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const pick = (videoId: string) => {
    const url = watchUrl(videoId);
    setValue("");
    setOpen(false);
    setResults([]);
    onSelect(videoId, url);
  };

  const handleSave = (videoId: string) => {
    onSave?.(videoId, watchUrl(videoId));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (parsedVideoId) {
        pick(parsedVideoId);
        return;
      }
      if (highlightIndex >= 0 && results[highlightIndex]) {
        pick(results[highlightIndex].videoId);
      }
      return;
    }

    if (!open || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    }
  };

  return (
    <div className="relative flex-1 min-w-0">
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (results.length || error) setOpen(true);
        }}
        placeholder={placeholder}
        disabled={disabled}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        className={cn(
          "flex-1 min-w-0 bg-transparent border-none outline-none disabled:opacity-50",
          inputClassName
        )}
        style={{ color: "var(--txt)", fontSize: 13 }}
      />

      {open && (loading || error || results.length > 0) && (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 bottom-full mb-2 z-50 rounded-xl overflow-hidden border shadow-lg"
          style={{
            borderColor: "var(--line)",
            background: "var(--card, #1c120b)",
            maxHeight: 320,
          }}
        >
          {loading && (
            <div className="px-3 py-2 text-[12px]" style={{ color: "var(--sub)" }}>
              Searching…
            </div>
          )}

          {!loading && error && (
            <div className="px-3 py-2 text-[12px]" style={{ color: "var(--sub)" }}>
              {error}
            </div>
          )}

          {!loading &&
            results.map((r, i) => (
              <div
                key={r.videoId}
                role="option"
                aria-selected={i === highlightIndex}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 cursor-pointer",
                  i === highlightIndex && "bg-[#ffffff12]"
                )}
                onMouseEnter={() => setHighlightIndex(i)}
              >
                <button
                  type="button"
                  className="flex items-center gap-2.5 flex-1 min-w-0 text-left bg-transparent border-none cursor-pointer p-0"
                  style={{ color: "var(--txt)" }}
                  onClick={() => pick(r.videoId)}
                >
                  <span
                    className="w-10 h-10 rounded-lg shrink-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${r.thumbnailUrl})` }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold truncate">
                      {r.title}
                    </span>
                    <span
                      className="block text-[11px] truncate"
                      style={{ color: "var(--sub)" }}
                    >
                      {r.channelTitle}
                    </span>
                  </span>
                </button>
                {showSaveAction && onSave && (
                  <button
                    type="button"
                    title="Save to crate"
                    aria-label="Save to crate"
                    onClick={() => handleSave(r.videoId)}
                    className="shrink-0 w-8 h-8 rounded-lg border-none cursor-pointer text-sm"
                    style={{
                      background: "#ffffff14",
                      color: "var(--txt)",
                    }}
                  >
                    ♥
                  </button>
                )}
                {showSaveAction && isDj && (
                  <button
                    type="button"
                    title="Drop track"
                    aria-label="Drop track"
                    onClick={() => pick(r.videoId)}
                    className="shrink-0 w-8 h-8 rounded-lg border-none cursor-pointer text-sm font-extrabold"
                    style={{
                      background:
                        "linear-gradient(120deg, var(--glow2), var(--glow))",
                      color: "#1a0d06",
                    }}
                  >
                    +
                  </button>
                )}
              </div>
            ))}

          {!loading && results.length > 0 && (
            <div
              className="px-3 py-1.5 text-[10px] border-t"
              style={{ color: "var(--sub)", borderColor: "var(--line)" }}
            >
              Powered by YouTube
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify lint**

Run: `npm run lint`
Expected: no errors in new file

- [ ] **Step 3: Commit**

```bash
git add src/components/shared/TrackSearchInput.tsx
git commit -m "feat: add TrackSearchInput search dropdown component"
```

---

### Task 8: Integrate TrackSearchInput into drop bar and mobile sheet

**Files:**
- Modify: `src/components/venue/DropTrackBar.tsx`
- Modify: `src/components/venue/DropSheet.tsx`

- [ ] **Step 1: Update `DropTrackBar.tsx`**

Replace the `url` state and input with `TrackSearchInput`. Key changes:

```tsx
import { TrackSearchInput } from "@/components/shared/TrackSearchInput";

// Remove: const [url, setUrl] = useState("");

const submitUrl = async (url: string) => {
  if (!isDj) {
    onToast("Join a deck to drop tracks");
    return;
  }
  setLoading(true);
  try {
    const res = await fetch(`/api/rooms/${roomSlug}/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) {
      onToast(data.error || "Failed to drop track");
      return;
    }
    onToast("Added to the queue");
    onOpenQueue();
  } finally {
    setLoading(false);
  }
};
```

Replace the `<input ... placeholder="Paste a YouTube link..." />` block inside the flex container with:

```tsx
<TrackSearchInput
  disabled={loading}
  onSelect={(_videoId, url) => void submitUrl(url)}
/>
```

Remove the old `submitDrop` function's URL trimming logic tied to `url` state; keep the **Drop the Needle** button calling `submitDrop` only if you retain a separate paste path — otherwise remove the button's dependency on local url state (selection via dropdown or Enter triggers `submitUrl` directly). The **Drop the Needle** button can remain as a no-op hint or be removed; recommended: remove standalone button since Enter/dropdown selection submits. If keeping the button for pasted-but-not-entered URLs, expose `value` from TrackSearchInput via ref — simpler MVP: **remove Drop the Needle button**; search/select/Enter is the drop action (matches Turntable flow).

- [ ] **Step 2: Apply same pattern to `DropSheet.tsx`**

Use `TrackSearchInput` with `autoFocus` and `onSelect` calling the same POST logic. Update helper text to:

```tsx
<p className="text-[12px] mb-4" style={{ color: "var(--sub)" }}>
  {isDj
    ? "Search for a track or paste a YouTube link — it goes straight to the queue."
    : "Join a deck on stage to drop tracks."}
</p>
```

- [ ] **Step 3: Manual test**

1. Join a room as DJ
2. Type "daft punk" in drop bar → see results → click one → track queued
3. Paste `https://www.youtube.com/watch?v=dQw4w9WgXcQ` → Enter → track queued
4. Repeat on mobile drop sheet

- [ ] **Step 4: Commit**

```bash
git add src/components/venue/DropTrackBar.tsx src/components/venue/DropSheet.tsx
git commit -m "feat: integrate TrackSearchInput into drop bar and mobile sheet"
```

---

### Task 9: Crate Saved/Browse sub-tabs

**Files:**
- Modify: `src/components/venue/RoomSidePanel.tsx`

- [ ] **Step 1: Add crate sub-tab state**

Near other `useState` hooks, add:

```tsx
const [crateSubTab, setCrateSubTab] = useState<"saved" | "browse">("saved");
```

- [ ] **Step 2: Add sub-tab toggle in crate section**

Above the crate content (when `activeTab === "crate"`), add:

```tsx
<div className="flex gap-1 px-3.5 pt-3 shrink-0">
  {(["saved", "browse"] as const).map((tab) => (
    <button
      key={tab}
      type="button"
      onClick={() => setCrateSubTab(tab)}
      className="flex-1 py-1.5 rounded-lg text-[12px] font-bold capitalize cursor-pointer border-none"
      style={{
        background: crateSubTab === tab ? "#ffffff14" : "transparent",
        color: crateSubTab === tab ? "var(--txt)" : "var(--sub)",
      }}
    >
      {tab}
    </button>
  ))}
</div>
```

- [ ] **Step 3: Wrap existing saved list in `crateSubTab === "saved"`**

Update empty state copy:

```tsx
<p className="text-sm text-muted italic py-4 text-center">
  Nothing saved yet — try Browse to find tracks, or ♥ something while it spins.
</p>
```

- [ ] **Step 4: Add Browse panel with TrackSearchInput**

When `crateSubTab === "browse"`:

```tsx
import { TrackSearchInput } from "@/components/shared/TrackSearchInput";

// inside browse panel:
<TrackSearchInput
  showSaveAction
  isDj={isUserDj}
  disabled={!currentUserId}
  onSelect={(videoId, url) => void queueFromUrl(url)}
  onSave={(videoId, url) => void saveToCrate(url)}
/>
```

Add helpers:

```tsx
const queueFromUrl = async (url: string) => {
  if (!isUserDj) return;
  const res = await fetch(`/api/rooms/${roomSlug}/track`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await res.json();
  if (!res.ok) {
    onToast?.(data.error || "Failed to add to queue");
    return;
  }
  onToast?.("Added to the queue");
};

const saveToCrate = async (url: string) => {
  const res = await fetch("/api/users/me/crate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await res.json();
  if (!res.ok) {
    onToast?.(data.error || "Failed to save");
    return;
  }
  onToast?.(data.alreadySaved ? "Already in your crate" : "Saved to your crate");
  // refresh saved list
  if (currentUserId) {
    const profileRes = await fetch(`/api/users/${currentUserId}`);
    if (profileRes.ok) {
      const profileData = await profileRes.json();
      if (profileData?.savedTracks) setSavedTracks(profileData.savedTracks);
    }
  }
};
```

- [ ] **Step 5: Manual test**

1. Open Crate → Browse → search → Save → switch to Saved → track appears
2. As DJ: Browse → Drop → track in queue
3. As listener: Drop button hidden, Save works

- [ ] **Step 6: Commit**

```bash
git add src/components/venue/RoomSidePanel.tsx
git commit -m "feat: add Crate Browse sub-tab with search and save"
```

---

### Task 10: First-time DJ coach mark

**Files:**
- Create: `src/components/shared/DjDropHint.tsx`
- Modify: `src/components/venue/DropTrackBar.tsx`

- [ ] **Step 1: Create `DjDropHint.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "needle_dj_drop_hint_seen";

interface DjDropHintProps {
  isDj: boolean;
  onDismiss?: () => void;
}

export function DjDropHint({ isDj, onDismiss }: DjDropHintProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isDj) {
      setVisible(false);
      return;
    }
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    setVisible(true);
  }, [isDj]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
    onDismiss?.();
  };

  if (!visible) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[45] cursor-default"
        aria-label="Dismiss hint"
        onClick={dismiss}
      />
      <div
        className="absolute left-[22px] right-[22px] bottom-full mb-2 z-[46] px-4 py-3 rounded-xl text-[13px] font-bold shadow-lg"
        style={{
          background: "linear-gradient(120deg, var(--glow2), var(--glow))",
          color: "#1a0d06",
        }}
      >
        Search for a track or paste a YouTube link, then pick a result to drop.
        <button
          type="button"
          onClick={dismiss}
          className="ml-2 underline bg-transparent border-none cursor-pointer font-bold"
          style={{ color: "#1a0d06" }}
        >
          Got it
        </button>
      </div>
    </>
  );
}

export function markDjDropHintSeen(): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, "1");
  }
}
```

- [ ] **Step 2: Wire into `DropTrackBar.tsx`**

Wrap the drop bar container with `relative` and add:

```tsx
import { DjDropHint, markDjDropHintSeen } from "@/components/shared/DjDropHint";

// inside submitUrl after success:
markDjDropHintSeen();

// in JSX, inside the outer relative container:
<DjDropHint isDj={isDj} />
```

- [ ] **Step 3: Manual test**

1. Clear `localStorage.removeItem('needle_dj_drop_hint_seen')`
2. Join DJ booth → hint appears
3. Dismiss or drop track → hint never reappears

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/DjDropHint.tsx src/components/venue/DropTrackBar.tsx
git commit -m "feat: add first-time DJ drop hint coach mark"
```

---

### Task 11: README documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add YouTube API setup section**

After the Supabase setup section in README, add:

```markdown
### YouTube Data API (track search)

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable **YouTube Data API v3**
3. Create an API key (restrict to YouTube Data API v3 if desired)
4. Add to `.env.local`:

\`\`\`
YOUTUBE_API_KEY=your-api-key
\`\`\`

Search is optional — without a key, DJs can still paste YouTube links.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add YouTube API setup for track search"
```

---

### Task 12: Final verification

- [ ] **Step 1: Run unit tests**

Run: `npm test`
Expected: all tests PASS

- [ ] **Step 2: Run production build**

Run: `npm run build`
Expected: successful build

- [ ] **Step 3: Complete manual checklist from spec**

- [ ] Search → drop (desktop + mobile)
- [ ] Paste URL regression
- [ ] Crate Browse save + drop
- [ ] DJ hint once-only
- [ ] Missing API key graceful fallback

- [ ] **Step 4: Commit any fixups**

```bash
git add -A
git commit -m "fix: address issues found in final verification"
```

(Skip if nothing to fix.)

---

## Spec Coverage Checklist

| Spec requirement | Task |
|------------------|------|
| `GET /api/youtube/search` | Task 5 |
| Cache + rate limit | Task 2, 5 |
| `POST /api/users/me/crate` | Task 6 |
| `findOrCreateYouTubeTrack` | Task 4 |
| `TrackSearchInput` shared component | Task 7 |
| Drop bar integration | Task 8 |
| Mobile DropSheet | Task 8 |
| Crate Saved/Browse sub-tabs | Task 9 |
| DJ coach mark | Task 10 |
| Crate empty state copy | Task 9 |
| `YOUTUBE_API_KEY` in `.env.example` | Task 5 |
| README setup docs | Task 11 |
| Powered by YouTube attribution | Task 7 |
| Paste URL still works | Task 7, 8 |
| Missing API key 503 fallback | Task 5, 7 |
