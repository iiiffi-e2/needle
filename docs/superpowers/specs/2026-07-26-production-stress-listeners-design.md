# Production Stress Listeners — Design Spec

**Date:** 2026-07-26  
**Status:** Approved (brainstorming)  
**Problem:** Needle needs an opt-in, production-safe way to inject many fake listener-only users into one or more live rooms to observe UI crowd behavior and Realtime/presence fan-out under load — without leaving bots behind or spamming chat/energy/Needlebot side effects.

---

## Goals

1. **Enable on demand in production** via a secret-gated admin API and a thin admin UI.
2. **Inject fake listeners** into a primary room (bulk) and optionally 1–2 secondary rooms (lighter counts), hard-capped at **250** total.
3. **Stay present** via server-driven heartbeats so bots remain inside the existing 5-minute `last_seen` presence window.
4. **Explicit stop** from API and UI, plus **TTL auto-stop** that removes stress memberships if a run is forgotten.
5. **Silent inject** — no system chat, energy bumps, Needlebot, first-join stats, or badges.
6. **Phased load** — v1 = DB presence + heartbeats; control plane designed so a later `realtime` mode can add subscriber workers without rewriting start/stop.

## Non-Goals (v1)

- Full browser/Playwright bot swarm
- Fake DJs, queue activity, chat, or crowd reacts
- Concurrent stress runs (exactly one active run)
- Stressing YouTube search / playback correctness
- Public “load test” marketing UI or dashboards/charts
- Deleting bot Auth accounts on every stop (pool is reusable)

---

## Chosen Approach

**Server-orchestrated stress controller** behind `STRESS_TEST_SECRET`:

- Ensure a reusable pool of tagged bot users (fun public display names).
- Persist a single **run** record (rooms, counts, mode, TTL).
- Silently upsert `room_members` as `listener`.
- Cron/tick refreshes `last_seen` and expires the run.
- Stop (API, UI, or TTL) deletes only stress memberships; bot accounts remain pooled.

### Alternatives considered

| Approach | Why not chosen |
|----------|----------------|
| Script/CLI only from a laptop | No in-app UI; dies if the machine sleeps; weaker “enable in prod” story |
| Client-side browser swarm | Heavy, flaky, expensive; overkill for listener-only presence |
| Create/delete Auth users every run | Slow, rate-limit prone, messy teardown |

---

## Product Rules

### Access

| Rule | Behavior |
|------|----------|
| Gate | `STRESS_TEST_SECRET` required on all stress admin routes and UI actions |
| Missing/wrong secret | Prefer **404** (quiet surface) over advertising the endpoint |
| Who can run | Anyone with the secret (no separate allowlist in v1) |

### Caps

| Rule | Behavior |
|------|----------|
| Max listeners | **250** total across all rooms in a run |
| Max rooms | **3** (1 primary + up to 2 secondary) |
| Default TTL | **20 minutes** |
| Max TTL | **30 minutes** |
| Active runs | **One** — `POST` while a run is `running` returns **409**; operator must `DELETE` (stop) first |

### Distribution (primary-heavy)

Given `totalListeners` and rooms `[primary, ...secondaries]`:

- If 1 room: 100% to primary.
- If 2 rooms: **80%** primary, **20%** secondary (remainder to primary).
- If 3 rooms: **80%** primary, **10%** / **10%** to the two secondaries (remainder to primary).

Exact integer split is computed server-side; client-provided per-room counts are not required in v1 (primary-heavy is the product choice).

### Bot identity

| Rule | Behavior |
|------|----------|
| Pool | Reusable; grow on demand up to 250 tagged bots |
| Public display name | Unique fun / scary / cool generated names (not `LoadBot 001`) |
| Avatar | Normal-looking `avatar_color` (and optional avatar) so crowd UI looks real |
| Private tag | `users.is_stress_bot = true` (migration) — reliable cleanup filter; never shown in UI |
| Auth email | Stable internal pattern (e.g. `stress-bot-{n}@needle.internal`) — not shown as the public identity |
| Auth metadata | Optional `user_metadata.stress_bot = true` as a secondary signal |

### Join / leave behavior

| Rule | Behavior |
|------|----------|
| Inject | Upsert `room_members` with `role = 'listener'`, `last_seen = now()` via service role |
| Side effects | **None** — skip system chat, energy, Needlebot, `recordFirstRoomJoin`, badges |
| Heartbeat | Tick updates `last_seen` for all members belonging to the active run’s bot set |
| Stop / TTL | Delete `room_members` rows for stress bots in the run’s rooms only; leave bot `users` / Auth intact |
| Idempotent stop | DELETE when no active run returns success |

### Modes

| Mode | v1 | Behavior |
|------|----|----------|
| `presence` | Yes | Memberships + heartbeat tick |
| `realtime` | Later | Same control plane + N Realtime subscribers that refetch on `room_members` changes |

---

## Data Model

### `users` (migration)

```sql
ALTER TABLE public.users
  ADD COLUMN is_stress_bot BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX users_is_stress_bot_idx
  ON public.users (id)
  WHERE is_stress_bot = TRUE;
```

### `stress_runs` (new table)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `status` | TEXT | `running` \| `stopped` \| `expired` \| `failed` |
| `mode` | TEXT | `presence` (v1) \| `realtime` (later) |
| `primary_room_id` | UUID FK → rooms | |
| `secondary_room_ids` | UUID[] | 0–2 rooms |
| `total_listeners` | INT | ≤ 250 |
| `per_room_counts` | JSONB | `{ [roomId]: count }` |
| `bot_user_ids` | UUID[] | bots used in this run |
| `started_at` | TIMESTAMPTZ | |
| `expires_at` | TIMESTAMPTZ | |
| `stopped_at` | TIMESTAMPTZ NULL | |
| `error` | TEXT NULL | partial-failure message |
| `created_at` | TIMESTAMPTZ | |

Only one row with `status = 'running'` at a time (enforce in app logic; optional unique partial index).

RLS: no public access; all stress ops use service role.

---

## Architecture

```
Admin UI (/admin/stress) ──secret──► POST/GET/DELETE /api/admin/stress
                                              │
                                              ▼
                                    lib/stress-test.ts
                                      - ensureBotPool
                                      - startRun / stopRun
                                      - distributeCounts
                                      - silentUpsertMembers
                                      - teardownMemberships
                                              │
Vercel Cron / tick ──secret──► POST /api/admin/stress/tick
                                      - refresh last_seen
                                      - expire if past expires_at
```

**Why tick/cron instead of a long-lived loop:** Needle deploys on Vercel; serverless requests should not hold a 20-minute heartbeat loop. A scheduled tick (every ~1 minute) is enough vs the 5-minute presence window.

---

## API Contract

All routes require the stress secret (and/or `CRON_SECRET` for tick only).

### `POST /api/admin/stress`

Start a run.

**Body:**
```json
{
  "primaryRoomSlug": "lofi-lounge",
  "secondaryRoomSlugs": ["bass-cave", "indie-night"],
  "totalListeners": 120,
  "ttlMinutes": 20,
  "mode": "presence"
}
```

**Success:** `201` with run id, status, per-room counts, `expiresAt`, bot count used.  
**Errors:** 400 (caps/validation), 404 (unknown room / bad secret policy), 409 (run already active).

### `GET /api/admin/stress`

Current run summary or `{ status: "idle" }`.

### `DELETE /api/admin/stress`

Explicit stop: teardown memberships, mark run `stopped`. Idempotent.

### `POST /api/admin/stress/tick`

- If no running run → `{ ok: true, idle: true }`
- If `now >= expires_at` → teardown, mark `expired`
- Else batch-update `last_seen` for `bot_user_ids` in the run’s rooms

Protected by `CRON_SECRET` or the same stress secret. Wire via `vercel.json` cron (e.g. `* * * * *` or every minute as supported).

---

## Admin UI

**Route:** `/admin/stress` (not linked from main nav).

**Behavior:**
1. Prompt for stress secret (sessionStorage for the tab; never persist to DB).
2. Show idle vs active run status.
3. Form: primary room slug, optional secondary slugs, listener count (1–250), TTL (default 20, max 30), Start.
4. Stop button when a run is active.
5. No charts; status text only (counts, expires at, mode).

Page and mutations call the admin API with the secret header. Prefer not indexing / noindex; still rely on secret + quiet 404 for defense in depth.

---

## Error Handling & Ops

- Server enforces all caps regardless of UI.
- Mid-inject failure → mark run `failed`, teardown any memberships already written, return error detail.
- Tick failures logged; next tick retries heartbeat / expiry.
- Structured logs: run id, room slugs, counts, event (`start` / `stop` / `tick` / `expire` / `fail`). Avoid logging real-user PII.
- Env: `STRESS_TEST_SECRET` (required to enable harness). If unset, routes behave as not found / disabled.

---

## Testing

| Layer | Coverage |
|-------|----------|
| Unit | Distribution math; caps; silent inject does not call chat/energy/Needlebot helpers; stop/TTL teardown selects only `is_stress_bot` members |
| Manual | Prod dry-run at N=10 on a throwaway room: verify crowd UI, directory count, no chat spam, Stop clears members, TTL expiry path via shortened TTL in staging |

---

## Implementation Notes (for planning)

- Centralize in `src/lib/stress-test.ts` (mirror `dj-booth.ts` / `friends.ts` style).
- Reuse service-role admin client (`src/lib/supabase/admin.ts`).
- Username generator: compose adjective/noun (or similar) lists with collision retry against existing `display_name` / bot pool.
- Do **not** route bulk inject through `POST /api/rooms/[slug]` (that path has join side effects).
- Later `realtime` mode: same `stress_runs` row + worker that opens Supabase channels per bot subset; out of scope for v1 code paths beyond accepting/rejecting the mode field (`presence` only).

---

## Success Criteria

1. Operator can start ≤250 silent listeners across 1–3 rooms from UI or API using only the stress secret.
2. Real clients see bots in crowd / listener counts while a run is active.
3. No join chat/energy/Needlebot noise from inject.
4. Explicit stop and TTL both fully remove stress memberships; bot accounts remain for reuse.
5. Heartbeats keep bots present for the full TTL without a long-lived serverless request.
