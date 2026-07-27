import type { SupabaseClient } from "@supabase/supabase-js";
import { CROWD_COLORS } from "@/lib/design-tokens";
import {
  ensureUniqueDisplayName,
  generateStressDisplayName,
} from "@/lib/stress-bot-names";
import type { StressRun } from "@/lib/types";

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
  const { error } = await admin
    .from("room_members")
    .delete()
    .in("room_id", roomIds)
    .in("user_id", botUserIds);
  if (error) throw new Error(error.message);
}

function stressBotEmail(): string {
  const frag = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `stress-bot-${frag}@needle.internal`;
}

function isDuplicateAuthEmailError(message: string): boolean {
  return /already|duplicate|exists|registered/i.test(message);
}

async function resolveUserIdByEmail(
  admin: SupabaseClient,
  email: string
): Promise<string | null> {
  const { data } = await admin
    .from("users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  return data?.id ?? null;
}

async function tagStressBotProfile(
  admin: SupabaseClient,
  userId: string,
  displayName: string,
  color: string,
  taken: Set<string>
): Promise<string> {
  let name = displayName;
  let upErr: { message: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await admin
      .from("users")
      .update({
        is_stress_bot: true,
        display_name: name,
        avatar_color: color,
      })
      .eq("id", userId);
    if (!error) return name;
    // Unique collision with a non-bot user — pick a new name and retry.
    if (!/unique|duplicate/i.test(error.message) || attempt === 4) {
      upErr = error;
      break;
    }
    taken.add(name);
    name = ensureUniqueDisplayName(generateStressDisplayName(), taken);
    taken.add(name);
  }

  // Profile fields failed — still tag as bot so the auth user is not orphaned.
  const { error: flagErr } = await admin
    .from("users")
    .update({ is_stress_bot: true })
    .eq("id", userId);
  if (flagErr) {
    throw new Error(upErr?.message ?? flagErr.message);
  }
  return name;
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
  // Prefer stress-bot names only (avoid unbounded PII select); retry on unique collisions.
  const taken = new Set(
    bots
      .map((u) => u.display_name)
      .filter((n): n is string => Boolean(n))
  );

  while (bots.length < needed) {
    let displayName = ensureUniqueDisplayName(generateStressDisplayName(), taken);
    taken.add(displayName);
    const color = CROWD_COLORS[bots.length % CROWD_COLORS.length]!;

    let userId: string | null = null;
    let lastCreateError: string | null = null;
    for (let attempt = 0; attempt < 5 && !userId; attempt++) {
      const email = stressBotEmail();
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: crypto.randomUUID() + crypto.randomUUID(),
        user_metadata: {
          display_name: displayName,
          stress_bot: true,
        },
      });
      if (!error && created.user) {
        userId = created.user.id;
        break;
      }
      lastCreateError = error?.message ?? "failed to create stress bot";
      if (!error || !isDuplicateAuthEmailError(error.message)) {
        throw new Error(lastCreateError);
      }
      // Duplicate email: reuse existing public.users row if present, else retry new email.
      const existingId = await resolveUserIdByEmail(admin, email);
      if (existingId) {
        userId = existingId;
        break;
      }
    }
    if (!userId) {
      throw new Error(lastCreateError ?? "failed to create stress bot");
    }

    displayName = await tagStressBotProfile(
      admin,
      userId,
      displayName,
      color,
      taken
    );
    taken.add(displayName);
    bots.push({ id: userId, display_name: displayName });
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

function isUniqueViolation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  return /unique|duplicate key/i.test(error.message ?? "");
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
  let claimedRunId: string | null = null;
  try {
    botIds = await ensureBotPool(admin, validated.totalListeners);

    // Claim the single "running" slot before injecting memberships so a
    // concurrent start loses on unique index without tearing down peers.
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
      if (isUniqueViolation(error)) {
        return {
          error: "A stress run is already active; stop it first",
          status: 409,
        };
      }
      return { error: error?.message ?? "failed to create run", status: 500 };
    }

    claimedRunId = run.id;
    await silentUpsertMembers(admin, perRoom, botIds);

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
    let message = e instanceof Error ? e.message : "start failed";
    // Only tear down memberships this attempt may have injected (after claim).
    if (claimedRunId && botIds.length) {
      try {
        await teardownMemberships(admin, roomIds, botIds);
      } catch (teardownErr) {
        const tMsg =
          teardownErr instanceof Error ? teardownErr.message : "teardown failed";
        message = `${message}; cleanup: ${tMsg}`;
      }
    }
    if (claimedRunId) {
      await admin
        .from("stress_runs")
        .update({
          status: "failed",
          stopped_at: new Date().toISOString(),
          error: message,
        })
        .eq("id", claimedRunId);
    } else {
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
    }
    return { error: message, status: 500 };
  }
}

export async function stopStressRun(
  admin: SupabaseClient,
  reason: "stopped" | "expired"
): Promise<
  { ok: true; run: StressRun | null } | { ok: false; error: string }
> {
  const active = await getActiveStressRun(admin);
  if (!active) return { ok: true, run: null };

  const roomIds = [active.primary_room_id, ...active.secondary_room_ids];
  try {
    await teardownMemberships(admin, roomIds, active.bot_user_ids);
  } catch (e) {
    const message = e instanceof Error ? e.message : "teardown failed";
    return { ok: false, error: message };
  }

  const { data, error } = await admin
    .from("stress_runs")
    .update({
      status: reason,
      stopped_at: new Date().toISOString(),
    })
    .eq("id", active.id)
    .select("*")
    .single();

  if (error) {
    return {
      ok: false,
      error: `Memberships already torn down but status update failed: ${error.message}`,
    };
  }

  console.info(
    JSON.stringify({ event: `stress_${reason}`, runId: active.id })
  );
  return { ok: true, run: data ? mapRun(data) : active };
}

export async function tickStressRun(
  admin: SupabaseClient
): Promise<
  | { ok: true; action: "idle" | "heartbeat" | "expired" }
  | { ok: false; error: string }
> {
  const active = await getActiveStressRun(admin);
  if (!active) return { ok: true, action: "idle" };

  if (Date.now() >= Date.parse(active.expires_at)) {
    const stopped = await stopStressRun(admin, "expired");
    if (!stopped.ok) return { ok: false, error: stopped.error };
    return { ok: true, action: "expired" };
  }

  const roomIds = [active.primary_room_id, ...active.secondary_room_ids];
  const now = new Date().toISOString();
  const { error } = await admin
    .from("room_members")
    .update({ last_seen: now })
    .in("room_id", roomIds)
    .in("user_id", active.bot_user_ids);

  if (error) {
    return { ok: false, error: error.message };
  }

  console.info(
    JSON.stringify({ event: "stress_tick", runId: active.id, action: "heartbeat" })
  );
  return { ok: true, action: "heartbeat" };
}
