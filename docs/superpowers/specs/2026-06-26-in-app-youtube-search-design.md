# In-App YouTube Track Search — Design Spec

**Date:** 2026-06-26  
**Status:** Approved (brainstorming)  
**Problem:** New users don't know they need a YouTube link to drop a track, and leaving Needle to search YouTube breaks the room flow.

---

## Goals

1. Fix **discoverability** — users learn they can find music without visiting YouTube separately.
2. Fix **context switching** — search and pick tracks entirely inside Needle.
3. Support **two surfaces**: drop bar (DJ action) and Crate Browse (collection building).
4. Teach in-context when joining a deck — **no onboarding flow changes**.

## Non-Goals (MVP)

- Video preview before drop
- Duration filtering (exclude long live streams / mixes)
- Search history, trending, or recommendations
- Onboarding search step after signup
- Replacing YouTube as playback provider

---

## Chosen Approach

**Approach 1: Unified smart input + shared search component**

A single input accepts either a search query or a pasted YouTube URL (auto-detected). Results appear in a dropdown; selecting one drops or saves. The same `TrackSearchInput` component is reused in the drop bar and Crate Browse tab.

### Alternatives considered

| Approach | Why not chosen |
|----------|----------------|
| Tabbed drop bar (Search / Paste) | Extra click for power users; more UI complexity |
| Full-screen track picker modal | Slower for repeat DJs; overkill for MVP |

---

## Architecture

### Environment

Add server-only env var:

```
YOUTUBE_API_KEY=...
```

Document in `.env.example`. Requires Google Cloud project with **YouTube Data API v3** enabled.

### New API routes

#### `GET /api/youtube/search?q={query}`

- **Auth:** Required (logged-in user)
- **Validation:** Query trimmed, minimum 2 characters
- **Upstream:** YouTube Data API v3 `search.list`
  - Params: `part=snippet`, `type=video`, `maxResults=8`, `safeSearch=moderate`, `q={query}`
- **Response:**

```ts
{
  results: Array<{
    videoId: string;
    title: string;
    thumbnailUrl: string;
    channelTitle: string;
  }>;
}
```

- **Quota protection:**
  - In-memory cache keyed by normalized query, 1-hour TTL
  - Per-user rate limit: ~20 requests/minute
- **Errors:** Return `{ error: string }` with appropriate status; client falls back to paste-only UX

#### `POST /api/users/me/crate`

- **Auth:** Required
- **Body:** `{ url?: string; videoId?: string }` (one required)
- **Behavior:**
  1. Parse/validate YouTube video ID (reuse `parseYouTubeUrl`)
  2. Find or create row in `tracks` (reuse metadata fetch from track route)
  3. Upsert into `saved_tracks` on `(user_id, track_id)` with `room_id: null`
- **Response:** `{ saved: true, trackId: string }` or `{ saved: true, trackId: string, alreadySaved: true }`

Existing `POST /api/rooms/[slug]/track` unchanged — used for Drop from search results.

### Client-side URL detection

Reuse `parseYouTubeUrl` from `src/lib/youtube.ts`:

- If input matches a URL or 11-char video ID → skip search API; show single "Drop this track" row (fetch oEmbed metadata for display)
- Otherwise → debounced search (300ms) against `/api/youtube/search`

### No schema changes

Tracks and saved_tracks tables are sufficient. `saved_tracks.room_id` is already nullable.

---

## UI Components

### `TrackSearchInput` (new shared component)

**Props:**

```ts
interface TrackSearchInput {
  placeholder?: string;
  disabled?: boolean;
  onSelect: (videoId: string, url: string) => void;
  mode: "drop" | "browse"; // affects primary action label
  showSaveAction?: boolean; // true in Crate Browse
  onSave?: (videoId: string, url: string) => void;
  isDj?: boolean; // hide Drop when false in browse mode
}
```

**Behavior:**

- Text input with debounced search
- Dropdown below input with result rows: thumbnail, title, channel
- Keyboard: Arrow up/down to navigate, Enter to confirm, Escape to close
- Footer: "Powered by YouTube" attribution (API ToS requirement)
- Loading and empty states inline in dropdown

### Drop bar integration

**Files:** `DropTrackBar.tsx`, `DropSheet.tsx`

- Replace plain URL `<input>` with `TrackSearchInput`
- Placeholder: "Search for a track or paste a YouTube link…"
- On select → `POST /api/rooms/{slug}/track` with `{ url }` (existing flow)
- Preserve Enter-to-drop for pasted URLs

### Crate integration

**File:** `RoomSidePanel.tsx`

- Crate tab gains sub-tabs: **Saved** | **Browse**
- **Saved:** Current saved tracks list (unchanged)
- **Browse:** `TrackSearchInput` with Save + Drop actions
  - **Save** → `POST /api/users/me/crate`
  - **Drop** → `POST /api/rooms/{slug}/track` (visible only when `isUserDj`)
- After save, refresh saved tracks list and optionally switch to Saved sub-tab

### Mobile

- `DropSheet`: same `TrackSearchInput`
- Crate Browse: accessible via mobile drawer (existing Crate tab)

---

## In-Context Guidance

No changes to `/auth/onboarding`.

### First-time DJ coach mark

- Trigger: user joins DJ booth (`isUserDj` becomes true) and `localStorage.getItem("needle_dj_drop_hint_seen")` is absent
- Display: tooltip anchored to drop bar — "Search for a track or paste a YouTube link, then hit Drop the Needle."
- Dismiss: click anywhere, or first successful drop
- Persist: `localStorage.setItem("needle_dj_drop_hint_seen", "1")`

### Crate empty state (Saved sub-tab)

When no saved tracks:

> Nothing saved yet — try **Browse** to find tracks, or ♥ something while it spins.

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Query < 2 characters | No API call; dropdown hidden |
| No results | "No tracks found — try different words" |
| YouTube API failure / quota exceeded | Toast + inline message; paste URL still works |
| Video unavailable at drop | Existing track route error → toast |
| Non-DJ in Browse | Drop hidden; Save available |
| Duplicate save | Upsert succeeds; toast "Already in your crate" |
| Missing `YOUTUBE_API_KEY` | Search disabled server-side (503); client shows paste-only fallback |

---

## Testing Plan

### Manual

- [ ] Search query → select result → track queued (desktop drop bar)
- [ ] Search query → select result → track queued (mobile drop sheet)
- [ ] Paste YouTube URL in same input → track queued (regression)
- [ ] Paste bare video ID → track queued (regression)
- [ ] Crate Browse → Save → track appears in Saved sub-tab
- [ ] Crate Browse → Drop while on deck → track queued
- [ ] Crate Browse → Drop hidden when listener (not DJ)
- [ ] First-time DJ hint shows once, dismissed on drop
- [ ] API key missing → search gracefully disabled, paste works
- [ ] Rate limit / API error → friendly message, paste works

### Setup verification

- [ ] `YOUTUBE_API_KEY` documented in `.env.example`
- [ ] README updated with Google Cloud setup steps

---

## File Change Summary

| File | Change |
|------|--------|
| `src/lib/youtube.ts` | Add `searchYouTube()` helper (server-side fetch wrapper) |
| `src/app/api/youtube/search/route.ts` | New search endpoint |
| `src/app/api/users/me/crate/route.ts` | New save-to-crate endpoint |
| `src/components/shared/TrackSearchInput.tsx` | New shared search component |
| `src/components/venue/DropTrackBar.tsx` | Integrate TrackSearchInput |
| `src/components/venue/DropSheet.tsx` | Integrate TrackSearchInput |
| `src/components/venue/RoomSidePanel.tsx` | Crate Saved/Browse sub-tabs |
| `src/components/shared/DjDropHint.tsx` | New coach mark (optional small component) |
| `.env.example` | Add YOUTUBE_API_KEY |
| `README.md` | Document API key setup |

---

## Quota & Operations Notes

- Default YouTube Data API quota: 10,000 units/day
- `search.list` costs 100 units per call → ~100 uncached searches/day on free tier
- In-memory query cache (1-hour TTL) reduces repeat-query cost
- Request quota increase in Google Cloud Console if traffic grows
- Monitor 403 quota errors in logs
