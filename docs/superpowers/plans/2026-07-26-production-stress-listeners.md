# Production Stress Listeners Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a secret-gated production stress harness that injects up to 250 silent fake listeners into 1–3 rooms (primary-heavy), keeps them alive via cron heartbeats, and supports explicit stop plus TTL auto-cleanup — with a thin admin UI.

**Architecture:** Pure helpers + async orchestration in `src/lib/stress-test.ts` (service-role Supabase). Thin admin API under `/api/admin/stress` gated by `STRESS_TEST_SECRET`. Vercel Cron hits `/api/admin/stress/tick` every minute. Admin UI at `/admin/stress` stores the secret in sessionStorage only.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (Auth Admin + Postgres), Vitest, Vercel Cron

**Spec:** `docs/superpowers/specs/2026-07-26-production-stress-listeners-design.md`

## Global Constraints

- Max listeners per run: **250**
- Max rooms per run: **3** (1 primary + ≤2 secondary)
- Default TTL: **20** minutes; max TTL: **30** minutes
- Distribution: 1 room = 100%; 2 rooms = 80%/20%; 3 rooms = 80%/10%/10% (remainder to primary)
- Exactly **one** active run; POST while running → **409** (require explicit DELETE first)
- Wrong/missing secret → **404** (quiet); unset `STRESS_TEST_SECRET` → routes disabled (404)
- Silent inject: **no** system chat, energy, Needlebot, first-join stats, or badges
- Bot display names: fun/scary/cool unique names — **not** `LoadBot N`
- Tag bots with `users.is_stress_bot = true`; stop/TTL delete memberships only, keep Auth pool
- v1 mode: `presence` only; reject other modes with 400
- Explicit stop from API **and** UI; TTL auto-stop as safety net

---

## File Map

| File | Responsibility |
|------|----------------|
| `supabase/migrations/006_stress_test.sql` | `is_stress_bot` column + `stress_runs` table |
| `src/lib/types.ts` | `StressRun`, related types |
| `src/lib/stress-bot-names.ts` | Display-name word lists + generator |
| `src/lib/stress-test.ts` | Caps, distribution, auth gate, pool, start/stop/tick |
| `src/lib/stress-test.test.ts` | Unit tests for pure helpers |
| `src/app/api/admin/stress/route.ts` | GET/POST/DELETE stress runs |
| `src/app/api/admin/stress/tick/route.ts` | Cron heartbeat + TTL expiry |
| `src/app/admin/stress/page.tsx` | Thin secret-gated admin UI |
| `vercel.json` | Cron schedule for tick |
| `.env.example` | `STRESS_TEST_SECRET` (+ note `CRON_SECRET`) |

---

### Task 1: Schema migration

**Files:**
- Create: `supabase/migrations/006_stress_test.sql`

**Interfaces:**
- Produces: `public.users.is_stress_bot`, `public.stress_runs` table

- [ ] **Step 1: Create migration**

Create `supabase/migrations/006_stress_test.sql`:

```sql
-- Stress-test bot flag + run control plane

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_stress_bot BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS users_is_stress_bot_idx
  ON public.users (id)
  WHERE is_stress_bot = TRUE;

CREATE TABLE IF NOT EXISTS public.stress_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status TEXT NOT NULL CHECK (status IN ('running', 'stopped', 'expired', 'failed')),
  mode TEXT NOT NULL DEFAULT 'presence' CHECK (mode IN ('presence', 'realtime')),
  primary_room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  secondary_room_ids UUID[] NOT NULL DEFAULT '{}',
  total_listeners INTEGER NOT NULL CHECK (total_listeners > 0 AND total_listeners <= 250),
  per_room_counts JSONB NOT NULL DEFAULT '{}',
  bot_user_ids UUID[] NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  stopped_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS stress_runs_one_running_idx
  ON public.stress_runs ((status))
  WHERE status = 'running';

ALTER TABLE public.stress_runs ENABLE ROW LEVEL SECURITY;
-- No policies: service role only
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/006_stress_test.sql
git commit -m "feat(stress): add is_stress_bot and stress_runs schema"
```

---

### Task 2: Pure helpers + unit tests

**Files:**
- Create: `src/lib/stress-bot-names.ts`
- Create: `src/lib/stress-test.ts` (pure exports only in this task; async stubs can wait for Task 3 — put pure functions here now)
- Create: `src/lib/stress-test.test.ts`
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces:
  - `MAX_STRESS_LISTENERS = 250`
  - `MAX_STRESS_ROOMS = 3`
  - `DEFAULT_STRESS_TTL_MINUTES = 20`
  - `MAX_STRESS_TTL_MINUTES = 30`
  - `distributeStressCounts(total: number, roomIds: string[]): Record<string, number>`
  - `validateStressStartInput(input): { ok: true; ... } | { ok: false; error: string }`
  - `generateStressDisplayName(rng?: () => number): string`
  - `ensureUniqueDisplayName(candidate: string, taken: Set<string>): string`
  - Types: `StressRunStatus`, `StressRunMode`, `StressRun`

- [ ] **Step 1: Add types to `src/lib/types.ts`**

Append:

```ts
export type StressRunStatus = "running" | "stopped" | "expired" | "failed";
export type StressRunMode = "presence" | "realtime";

export interface StressRun {
  id: string;
  status: StressRunStatus;
  mode: StressRunMode;
  primary_room_id: string;
  secondary_room_ids: string[];
  total_listeners: number;
  per_room_counts: Record<string, number>;
  bot_user_ids: string[];
  started_at: string;
  expires_at: string;
  stopped_at: string | null;
  error: string | null;
  created_at: string;
}
```

Also add `is_stress_bot?: boolean` to the existing `User` interface.

- [ ] **Step 2: Create `src/lib/stress-bot-names.ts`**

```ts
const ADJECTIVES = [
  "Void", "Neon", "Cryptic", "Savage", "Ghost", "Toxic", "Chrome", "Feral",
  "Hollow", "Lucid", "Rogue", "Silent", "Brutal", "Cosmic", "Wicked", "Ashen",
  "Frozen", "Iron", "Phantom", "Vivid", "Cursed", "Electric", "Noir", "Wild",
  "Obsidian", "Crimson", "Solar", "Noirish", "Haunted", "Radiant",
] as const;

const NOUNS = [
  "Moth", "Reaper", "Viper", "Wraith", "Fox", "Raven", "Blade", "Echo",
  "Wolf", "Specter", "Drifter", "Spark", "Shade", "Hawk", "Cipher", "Pulse",
  "Serpent", "Mirage", "Crow", "Nomad", "Ember", "Fang", "Orbit", "Thorn",
  "Golem", "Siren", "Comet", "Dagger", "Phantom", "Storm",
] as const;

/** Fun/scary/cool display name. Pass rng for tests (returns 0..1). */
export function generateStressDisplayName(rng: () => number = Math.random): string {
  const adj = ADJECTIVES[Math.floor(rng() * ADJECTIVES.length)]!;
  const noun = NOUNS[Math.floor(rng() * NOUNS.length)]!;
  return `${adj}${noun}`;
}

/** If taken, append 2–4 digit suffix until unique. */
export function ensureUniqueDisplayName(
  candidate: string,
  taken: Set<string>,
  rng: () => number = Math.random
): string {
  const lowerTaken = new Set([...taken].map((s) => s.toLowerCase()));
  if (!lowerTaken.has(candidate.toLowerCase())) return candidate;
  for (let i = 0; i < 50; i++) {
    const suffix = String(Math.floor(rng() * 9000) + 1000);
    const next = `${candidate}${suffix}`;
    if (!lowerTaken.has(next.toLowerCase())) return next;
  }
  return `${candidate}${Date.now().toString(36)}`;
}
```

- [ ] **Step 3: Add pure helpers at top of `src/lib/stress-test.ts`**

```ts
export const MAX_STRESS_LISTENERS = 250;
export const MAX_STRESS_ROOMS = 3;
export const DEFAULT_STRESS_TTL_MINUTES = 20;
export const MAX_STRESS_TTL_MINUTES = 30;

export function distributeStressCounts(
  total: number,
  roomIds: string[]
): Record<string, number> {
  if (roomIds.length === 0) return {};
  if (roomIds.length === 1) return { [roomIds[0]!]: total };

  const counts: Record<string, number> = {};
  if (roomIds.length === 2) {
    const secondary = Math.floor(total * 0.2);
    counts[roomIds[0]!] = total - secondary;
    counts[roomIds[1]!] = secondary;
    return counts;
  }

  // 3 rooms: 80 / 10 / 10
  const s1 = Math.floor(total * 0.1);
  const s2 = Math.floor(total * 0.1);
  counts[roomIds[0]!] = total - s1 - s2;
  counts[roomIds[1]!] = s1;
  counts[roomIds[2]!] = s2;
  return counts;
}

export type StressStartInput = {
  primaryRoomSlug: string;
  secondaryRoomSlugs?: string[];
  totalListeners: number;
  ttlMinutes?: number;
  mode?: string;
};

export function validateStressStartInput(input: StressStartInput):
  | {
      ok: true;
      primaryRoomSlug: string;
      secondaryRoomSlugs: string[];
      totalListeners: number;
      ttlMinutes: number;
      mode: "presence";
    }
  | { ok: false; error: string } {
  const primary = (input.primaryRoomSlug ?? "").trim();
  if (!primary) return { ok: false, error: "primaryRoomSlug is required" };

  const secondary = [...new Set((input.secondaryRoomSlugs ?? []).map((s) => s.trim()).filter(Boolean))];
  if (secondary.includes(primary)) {
    return { ok: false, error: "secondary rooms must not include primary" };
  }
  if (1 + secondary.length > MAX_STRESS_ROOMS) {
    return { ok: false, error: `at most ${MAX_STRESS_ROOMS} rooms` };
  }

  const total = input.totalListeners;
  if (!Number.isInteger(total) || total < 1 || total > MAX_STRESS_LISTENERS) {
    return { ok: false, error: `totalListeners must be 1–${MAX_STRESS_LISTENERS}` };
  }

  const ttl = input.ttlMinutes ?? DEFAULT_STRESS_TTL_MINUTES;
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > MAX_STRESS_TTL_MINUTES) {
    return { ok: false, error: `ttlMinutes must be 1–${MAX_STRESS_TTL_MINUTES}` };
  }

  const mode = input.mode ?? "presence";
  if (mode !== "presence") {
    return { ok: false, error: "only mode 'presence' is supported in v1" };
  }

  return {
    ok: true,
    primaryRoomSlug: primary,
    secondaryRoomSlugs: secondary,
    totalListeners: total,
    ttlMinutes: ttl,
    mode: "presence",
  };
}
```

- [ ] **Step 4: Write `src/lib/stress-test.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  distributeStressCounts,
  validateStressStartInput,
  MAX_STRESS_LISTENERS,
} from "./stress-test";
import {
  ensureUniqueDisplayName,
  generateStressDisplayName,
} from "./stress-bot-names";

describe("distributeStressCounts", () => {
  it("puts all in one room", () => {
    expect(distributeStressCounts(100, ["a"])).toEqual({ a: 100 });
  });

  it("splits 80/20 for two rooms", () => {
    expect(distributeStressCounts(100, ["a", "b"])).toEqual({ a: 80, b: 20 });
  });

  it("splits 80/10/10 for three rooms with remainder on primary", () => {
    expect(distributeStressCounts(101, ["a", "b", "c"])).toEqual({
      a: 81,
      b: 10,
      c: 10,
    });
  });
});

describe("validateStressStartInput", () => {
  it("accepts valid input with defaults", () => {
    const r = validateStressStartInput({
      primaryRoomSlug: "lofi",
      totalListeners: 10,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ttlMinutes).toBe(20);
      expect(r.mode).toBe("presence");
    }
  });

  it("rejects over max listeners", () => {
    const r = validateStressStartInput({
      primaryRoomSlug: "lofi",
      totalListeners: MAX_STRESS_LISTENERS + 1,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects realtime mode in v1", () => {
    const r = validateStressStartInput({
      primaryRoomSlug: "lofi",
      totalListeners: 5,
      mode: "realtime",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects more than 2 secondaries", () => {
    const r = validateStressStartInput({
      primaryRoomSlug: "a",
      secondaryRoomSlugs: ["b", "c", "d"],
      totalListeners: 5,
    });
    expect(r.ok).toBe(false);
  });
});

describe("generateStressDisplayName", () => {
  it("returns AdjNoun form", () => {
    const name = generateStressDisplayName(() => 0);
    expect(name).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+$/);
  });

  it("ensureUniqueDisplayName suffixes on collision", () => {
    const taken = new Set(["VoidMoth"]);
    const next = ensureUniqueDisplayName("VoidMoth", taken, () => 0.5);
    expect(next).not.toBe("VoidMoth");
    expect(next.startsWith("VoidMoth")).toBe(true);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm test -- src/lib/stress-test.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/stress-bot-names.ts src/lib/stress-test.ts src/lib/stress-test.test.ts
git commit -m "feat(stress): add distribution, validation, and bot name helpers"
```

---

### Task 3: Stress orchestration (pool, start, stop, tick)

**Files:**
- Modify: `src/lib/stress-test.ts`

**Interfaces:**
- Consumes: pure helpers from Task 2; `createServiceClient` from `@/lib/supabase/admin`; `CROWD_COLORS` from `@/lib/design-tokens`; name helpers from `@/lib/stress-bot-names`
- Produces:
  - `assertStressSecret(request: Request): boolean` — true if authorized
  - `getActiveStressRun(admin): Promise<StressRun | null>`
  - `startStressRun(admin, input): Promise<{ run: StressRun } | { error: string; status: number }>`
  - `stopStressRun(admin, reason: 'stopped' | 'expired'): Promise<{ ok: true; run: StressRun | null }>`
  - `tickStressRun(admin): Promise<{ ok: true; action: 'idle' | 'heartbeat' | 'expired' }>`

- [ ] **Step 1: Implement auth + orchestration in `src/lib/stress-test.ts`**

Add (alongside existing pure helpers):

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { CROWD_COLORS } from "@/lib/design-tokens";
import {
  ensureUniqueDisplayName,
  generateStressDisplayName,
} from "@/lib/stress-bot-names";
import type { StressRun } from "@/lib/types";

export function assertStressSecret(request: Request): boolean {
  const expected = process.env.STRESS_TEST_SECRET;
  if (!expected) return false;
  const header = request.headers.get("authorization");
  if (header === `Bearer ${expected}`) return true;
  const alt = request.headers.get("x-stress-secret");
  return alt === expected;
}

export function assertCronSecret(request: Request): boolean {
  const cron = process.env.CRON_SECRET;
  if (cron) {
    const auth = request.headers.get("authorization");
    if (auth === `Bearer ${cron}`) return true;
  }
  return assertStressSecret(request);
}

function mapRun(row: Record<string, unknown>): StressRun {
  return {
    id: row.id as string,
    status: row.status as StressRun["status"],
    mode: row.mode as StressRun["mode"],
    primary_room_id: row.primary_room_id as string,
    secondary_room_ids: (row.secondary_room_ids as string[]) ?? [],
    total_listeners: row.total_listeners as number,
    per_room_counts: (row.per_room_counts as Record<string, number>) ?? {},
    bot_user_ids: (row.bot_user_ids as string[]) ?? [],
    started_at: row.started_at as string,
    expires_at: row.expires_at as string,
    stopped_at: (row.stopped_at as string | null) ?? null,
    error: (row.error as string | null) ?? null,
    created_at: row.created_at as string,
  };
}

export async function getActiveStressRun(
  admin: SupabaseClient
): Promise<StressRun | null> {
  const { data } = await admin
    .from("stress_runs")
    .select("*")
    .eq("status", "running")
    .maybeSingle();
  return data ? mapRun(data) : null;
}

async function teardownMemberships(
  admin: SupabaseClient,
  roomIds: string[],
  botUserIds: string[]
): Promise<void> {
  if (!roomIds.length || !botUserIds.length) return;
  await admin
    .from("room_members")
    .delete()
    .in("room_id", roomIds)
    .in("user_id", botUserIds);
}

async function ensureBotPool(
  admin: SupabaseClient,
  needed: number
): Promise<string[]> {
  const { data: existing } = await admin
    .from("users")
    .select("id, display_name")
    .eq("is_stress_bot", true)
    .limit(MAX_STRESS_LISTENERS);

  const bots = [...(existing ?? [])];
  const taken = new Set(
    (await admin.from("users").select("display_name")).data
      ?.map((u) => u.display_name)
      .filter(Boolean) as string[]
  );

  while (bots.length < needed) {
    const n = bots.length + 1;
    const email = `stress-bot-${n}@needle.internal`;
    const baseName = generateStressDisplayName();
    const displayName = ensureUniqueDisplayName(baseName, taken);
    taken.add(displayName);
    const color = CROWD_COLORS[bots.length % CROWD_COLORS.length]!;

    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      password: crypto.randomUUID() + crypto.randomUUID(),
      user_metadata: {
        display_name: displayName,
        stress_bot: true,
      },
    });
    if (error || !created.user) {
      throw new Error(error?.message ?? "failed to create stress bot");
    }

    // Trigger creates public.users; update flag + profile fields
    const { error: upErr } = await admin
      .from("users")
      .update({
        is_stress_bot: true,
        display_name: displayName,
        avatar_color: color,
      })
      .eq("id", created.user.id);
    if (upErr) throw new Error(upErr.message);

    bots.push({ id: created.user.id, display_name: displayName });
  }

  return bots.slice(0, needed).map((b) => b.id);
}

async function silentUpsertMembers(
  admin: SupabaseClient,
  perRoom: Record<string, number>,
  botIds: string[]
): Promise<void> {
  let offset = 0;
  const now = new Date().toISOString();
  const rows: { room_id: string; user_id: string; role: string; last_seen: string }[] = [];
  for (const [roomId, count] of Object.entries(perRoom)) {
    const slice = botIds.slice(offset, offset + count);
    offset += count;
    for (const userId of slice) {
      rows.push({
        room_id: roomId,
        user_id: userId,
        role: "listener",
        last_seen: now,
      });
    }
  }
  if (!rows.length) return;
  const { error } = await admin.from("room_members").upsert(rows, {
    onConflict: "room_id,user_id",
  });
  if (error) throw new Error(error.message);
}

export async function startStressRun(
  admin: SupabaseClient,
  raw: StressStartInput
): Promise<{ run: StressRun } | { error: string; status: number }> {
  const validated = validateStressStartInput(raw);
  if (!validated.ok) return { error: validated.error, status: 400 };

  const active = await getActiveStressRun(admin);
  if (active) {
    return { error: "A stress run is already active; stop it first", status: 409 };
  }

  const slugs = [validated.primaryRoomSlug, ...validated.secondaryRoomSlugs];
  const { data: rooms, error: roomErr } = await admin
    .from("rooms")
    .select("id, slug")
    .in("slug", slugs);
  if (roomErr) return { error: roomErr.message, status: 500 };
  if (!rooms || rooms.length !== slugs.length) {
    return { error: "One or more rooms not found", status: 404 };
  }

  const bySlug = new Map(rooms.map((r) => [r.slug, r.id]));
  const primaryId = bySlug.get(validated.primaryRoomSlug)!;
  const secondaryIds = validated.secondaryRoomSlugs.map((s) => bySlug.get(s)!);
  const roomIds = [primaryId, ...secondaryIds];
  const perRoom = distributeStressCounts(validated.totalListeners, roomIds);

  let botIds: string[] = [];
  try {
    botIds = await ensureBotPool(admin, validated.totalListeners);
    await silentUpsertMembers(admin, perRoom, botIds);

    const expiresAt = new Date(
      Date.now() + validated.ttlMinutes * 60_000
    ).toISOString();

    const { data: run, error } = await admin
      .from("stress_runs")
      .insert({
        status: "running",
        mode: "presence",
        primary_room_id: primaryId,
        secondary_room_ids: secondaryIds,
        total_listeners: validated.totalListeners,
        per_room_counts: perRoom,
        bot_user_ids: botIds,
        expires_at: expiresAt,
      })
      .select("*")
      .single();

    if (error || !run) {
      await teardownMemberships(admin, roomIds, botIds);
      return { error: error?.message ?? "failed to create run", status: 500 };
    }

    console.info(
      JSON.stringify({
        event: "stress_start",
        runId: run.id,
        total: validated.totalListeners,
        rooms: slugs,
      })
    );
    return { run: mapRun(run) };
  } catch (e) {
    await teardownMemberships(admin, roomIds, botIds);
    const message = e instanceof Error ? e.message : "start failed";
    await admin.from("stress_runs").insert({
      status: "failed",
      mode: "presence",
      primary_room_id: primaryId,
      secondary_room_ids: secondaryIds,
      total_listeners: validated.totalListeners,
      per_room_counts: perRoom,
      bot_user_ids: botIds,
      expires_at: new Date().toISOString(),
      stopped_at: new Date().toISOString(),
      error: message,
    });
    return { error: message, status: 500 };
  }
}

export async function stopStressRun(
  admin: SupabaseClient,
  reason: "stopped" | "expired"
): Promise<{ ok: true; run: StressRun | null }> {
  const active = await getActiveStressRun(admin);
  if (!active) return { ok: true, run: null };

  const roomIds = [active.primary_room_id, ...active.secondary_room_ids];
  await teardownMemberships(admin, roomIds, active.bot_user_ids);

  const { data } = await admin
    .from("stress_runs")
    .update({
      status: reason,
      stopped_at: new Date().toISOString(),
    })
    .eq("id", active.id)
    .select("*")
    .single();

  console.info(
    JSON.stringify({ event: `stress_${reason}`, runId: active.id })
  );
  return { ok: true, run: data ? mapRun(data) : active };
}

export async function tickStressRun(
  admin: SupabaseClient
): Promise<{ ok: true; action: "idle" | "heartbeat" | "expired" }> {
  const active = await getActiveStressRun(admin);
  if (!active) return { ok: true, action: "idle" };

  if (Date.now() >= Date.parse(active.expires_at)) {
    await stopStressRun(admin, "expired");
    return { ok: true, action: "expired" };
  }

  const roomIds = [active.primary_room_id, ...active.secondary_room_ids];
  const now = new Date().toISOString();
  await admin
    .from("room_members")
    .update({ last_seen: now })
    .in("room_id", roomIds)
    .in("user_id", active.bot_user_ids);

  console.info(
    JSON.stringify({ event: "stress_tick", runId: active.id, action: "heartbeat" })
  );
  return { ok: true, action: "heartbeat" };
}
```

Notes for implementer:
- Prefer `crypto.randomUUID()` (Node/Web crypto) for bot passwords.
- If `users` select of all display names is too heavy, select only `display_name` where not null with a reasonable limit, or only stress bots + retry on unique collision — do not pull unbounded PII beyond display_name.
- Do **not** call `postSystemMessage`, energy, Needlebot, or `recordFirstRoomJoin`.

- [ ] **Step 2: Commit**

```bash
git add src/lib/stress-test.ts
git commit -m "feat(stress): orchestrate bot pool, start, stop, and tick"
```

---

### Task 4: Admin API routes

**Files:**
- Create: `src/app/api/admin/stress/route.ts`
- Create: `src/app/api/admin/stress/tick/route.ts`

**Interfaces:**
- Consumes: `assertStressSecret`, `assertCronSecret`, `getActiveStressRun`, `startStressRun`, `stopStressRun`, `tickStressRun`, `createServiceClient`

- [ ] **Step 1: Create `src/app/api/admin/stress/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  assertStressSecret,
  getActiveStressRun,
  startStressRun,
  stopStressRun,
} from "@/lib/stress-test";

function unauthorized() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET(request: Request) {
  if (!assertStressSecret(request)) return unauthorized();
  const admin = createServiceClient();
  const run = await getActiveStressRun(admin);
  if (!run) return NextResponse.json({ status: "idle" });
  return NextResponse.json({ status: "running", run });
}

export async function POST(request: Request) {
  if (!assertStressSecret(request)) return unauthorized();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const admin = createServiceClient();
  const result = await startStressRun(admin, body as Parameters<typeof startStressRun>[1]);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result, { status: 201 });
}

export async function DELETE(request: Request) {
  if (!assertStressSecret(request)) return unauthorized();
  const admin = createServiceClient();
  const result = await stopStressRun(admin, "stopped");
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Create `src/app/api/admin/stress/tick/route.ts`**

```ts
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { assertCronSecret, tickStressRun } from "@/lib/stress-test";

export async function POST(request: Request) {
  if (!assertCronSecret(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const admin = createServiceClient();
  const result = await tickStressRun(admin);
  return NextResponse.json(result);
}

// Vercel Cron sends GET by default for some configs — support both
export async function GET(request: Request) {
  return POST(request);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/stress/route.ts src/app/api/admin/stress/tick/route.ts
git commit -m "feat(stress): add admin stress API and tick endpoint"
```

---

### Task 5: Thin admin UI

**Files:**
- Create: `src/app/admin/stress/page.tsx`

**Interfaces:**
- Consumes: `/api/admin/stress` with `Authorization: Bearer <secret>`
- Produces: `/admin/stress` page (client component ok)

- [ ] **Step 1: Create page**

Create a client page at `src/app/admin/stress/page.tsx`:

- `robots: noindex` via exporting `metadata` from a thin server wrapper **or** a single client page with `<meta name="robots" content="noindex" />` in layout — prefer:

`src/app/admin/stress/layout.tsx`:
```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Stress harness",
};

export default function StressAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
```

`src/app/admin/stress/page.tsx` — client component:
- On mount, read secret from `sessionStorage` key `needle_stress_secret`
- If no secret: form to enter secret → save to sessionStorage → unlock
- When unlocked: poll GET `/api/admin/stress` every 10s with `Authorization: Bearer …`
- Idle form fields: `primaryRoomSlug`, `secondaryRoomSlugs` (comma-separated), `totalListeners` (number 1–250), `ttlMinutes` (default 20, max 30)
- Start → POST; Stop → DELETE
- Show status text only (run id, counts, expiresAt, mode) — no charts
- Match existing Needle styling lightly (use existing fonts/colors from the app; keep layout minimal — not a dashboard)

Keep the UI minimal (~150–250 lines). Do not link it from the main nav.

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/stress/
git commit -m "feat(stress): add thin secret-gated admin UI"
```

---

### Task 6: Cron + env wiring

**Files:**
- Create: `vercel.json`
- Modify: `.env.example`

- [ ] **Step 1: Create `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/admin/stress/tick",
      "schedule": "* * * * *"
    }
  ]
}
```

Note: Vercel Cron authenticates with `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set in the project env — `assertCronSecret` already accepts that.

- [ ] **Step 2: Update `.env.example`**

Append:

```
# Stress harness (optional — unset disables /api/admin/stress)
STRESS_TEST_SECRET=generate-a-long-random-string

# Vercel Cron (optional — tick also accepts STRESS_TEST_SECRET)
CRON_SECRET=generate-a-long-random-string
```

- [ ] **Step 3: Commit**

```bash
git add vercel.json .env.example
git commit -m "chore(stress): wire Vercel cron and env example secrets"
```

---

## Manual verification (after all tasks)

1. Apply `006_stress_test.sql` to the Supabase project.
2. Set `STRESS_TEST_SECRET` in `.env.local`.
3. Open `/admin/stress`, unlock with secret.
4. Start N=10 on a throwaway room → confirm crowd/listener count, **no** join chat spam.
5. Stop → members gone; bots remain in `users` with `is_stress_bot=true`.
6. Optional: start with `ttlMinutes: 1`, hit tick (or wait for cron) → auto-expire.

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Schema `is_stress_bot` + `stress_runs` | 1 |
| Caps 250 / 3 rooms / TTL 20–30 | 2 |
| Primary-heavy distribution | 2 |
| Fun unique bot names | 2–3 |
| Silent inject | 3 |
| Start/stop/tick orchestration | 3 |
| Secret-gated API + 404 | 4 |
| Explicit stop API | 4 |
| Cron tick + TTL | 4, 6 |
| Thin admin UI + stop | 5 |
| Env + vercel cron | 6 |
| One active run → 409 | 3 |
| `presence` only v1 | 2–3 |
