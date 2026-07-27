# Task 3 Report: Stress orchestration (pool, start, stop, tick)

## What was implemented

Extended `src/lib/stress-test.ts` with async Supabase orchestration alongside the existing pure helpers from Task 2. No calls to `postSystemMessage`, energy, Needlebot, or `recordFirstRoomJoin`.

Exports added:

| Export | Role |
|--------|------|
| `assertStressSecret` | Authorize via `Authorization: Bearer` or `x-stress-secret` against `STRESS_TEST_SECRET` |
| `assertCronSecret` | Allow `CRON_SECRET` bearer, else fall back to stress secret |
| `getActiveStressRun` | Load the single `status = running` row (or null) |
| `startStressRun` | Validate input, refuse if active, resolve rooms, ensure bot pool, silent membership upsert, insert run |
| `stopStressRun` | Tear down bot memberships and mark run `stopped` / `expired` |
| `tickStressRun` | Idle / expire / heartbeat (`last_seen` bump) |

Internal helpers: `mapRun`, `teardownMemberships`, `ensureBotPool`, `silentUpsertMembers`.

### Bot pool notes

- Reuses existing `is_stress_bot` users up to `MAX_STRESS_LISTENERS`.
- Creates auth users via `admin.auth.admin.createUser`, then updates `public.users` (`is_stress_bot`, `display_name`, `avatar_color`) — relies on the auth→public.users trigger.
- **Display names:** builds the taken set from stress-bot `display_name`s only (avoids unbounded select of all users). On unique/duplicate update errors, retries with a new generated name (up to 5 attempts).
- Passwords use `crypto.randomUUID() + crypto.randomUUID()`.
- Avatar colors cycle `CROWD_COLORS`.

### Start / failure behavior

- 400 validation, 409 if a run is already active, 404 if rooms missing, 500 on pool/membership/insert failures.
- On failure after bots were joined: tears down memberships; inserts a `failed` stress_runs row with error text.

## Files changed

| File | Action |
|------|--------|
| `src/lib/stress-test.ts` | Modified (appended orchestration; pure exports preserved) |

## Commit

```
800b5bf feat(stress): orchestrate bot pool, start, stop, and tick
```

Branch: `feat/stress-listeners`

## Test evidence

**Full suite** (`npm test`):

```
 Test Files  6 passed (6)
      Tests  51 passed (51)
   Duration  417ms
```

Existing pure-helper unit tests in `stress-test.test.ts` still pass; no new orchestration unit tests (Supabase-backed; deferred to API/integration tasks).

## Self-review

- **Brief fidelity:** Matches task brief orchestration surface and control flow; intentional deviation in `ensureBotPool` for name uniqueness (stress bots + collision retry instead of selecting all `display_name`s).
- **Pure exports intact:** Constants, `distributeStressCounts`, `StressStartInput`, `validateStressStartInput` unchanged in behavior.
- **Silent presence:** Membership upserts set `role: "listener"` and `last_seen` only — no system messages / energy / Needlebot / first-join side effects.
- **TTL expiry:** `tickStressRun` compares `Date.now()` to `expires_at` and routes through `stopStressRun(..., "expired")`.

## Concerns

- Bot emails are `stress-bot-${n}@needle.internal` keyed off current pool length; orphans in auth without `is_stress_bot` could cause create conflicts (edge case).
- Unique-collision retry detects Postgres-style “unique/duplicate” messages; other constraint error shapes would fail fast (acceptable).
- No integration tests against a live Supabase admin client in this task.

## Test summary

Full suite 51/51 passing; no new unit tests for async orchestration.

---

## Review fix notes (Important findings)

### 1. Teardown delete errors

- `teardownMemberships` now checks the Supabase delete `error` and throws on failure.
- `stopStressRun` catches teardown failure and returns `{ ok: false, error }` **without** updating run status to stopped/expired.
- `tickStressRun` expiry path checks `stopStressRun` result; on teardown failure returns `{ ok: false, error }` instead of claiming `action: "expired"`.
- Start-path cleanup still attempts teardown and appends `cleanup: …` to the error message if teardown also fails.

### 2. Bot pool email uniqueness / orphan recovery

- New bots use `stress-bot-<12-char-uuid-fragment>@needle.internal` instead of `stress-bot-${n}@…`.
- On `createUser` duplicate-email errors: look up `public.users` by email and reuse that id (after tagging), otherwise retry with a fresh email (up to 5 attempts).
- Profile update extracted to `tagStressBotProfile`: on full profile update failure, still attempts `is_stress_bot: true` so the row is not left as a non-bot orphan.

### Follow-up commit

```
fix(stress): harden teardown errors and bot pool emails
```

### Test results (after fix)

```
 Test Files  6 passed (6)
      Tests  51 passed (51)
   Duration  399ms
```
