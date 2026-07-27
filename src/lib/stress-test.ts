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
