export const CROWD_COLORS = [
  "#ff7a59",
  "#ffd166",
  "#5ad1c8",
  "#8a7bff",
  "#ff6fae",
  "#7ed957",
  "#ffa94d",
  "#56b9ff",
] as const;

export const REACT_GLYPHS = ["♥", "★", "♪", "☺"] as const;

/** Stage canvas 940×716 — positions from Needle Room.dc.html */
export const CROWD_SPEC = [
  { x: 250, y: 362, s: 44, dance: true },
  { x: 352, y: 404, s: 50, dance: false },
  { x: 470, y: 438, s: 56, dance: true },
  { x: 556, y: 398, s: 48, dance: false },
  { x: 660, y: 450, s: 58, dance: true },
  { x: 760, y: 380, s: 44, dance: false },
  { x: 612, y: 548, s: 70, dance: true },
  { x: 486, y: 566, s: 74, dance: false },
  { x: 392, y: 520, s: 62, dance: true },
  { x: 806, y: 474, s: 54, dance: false },
] as const;

export const VENUE_W = 940;
export const VENUE_H = 716;

/**
 * Now-playing panel and quick-reacts sit at z-30. Crowd stacking must stay
 * strictly below that so avatars never paint over chrome.
 */
export const CROWD_UI_MAX_Z = 25;

/** Self avatar always paints above other crowd members, still under chrome. */
export function crowdZIndexForMember(baseZ: number, isSelf: boolean): number {
  return isSelf ? CROWD_UI_MAX_Z : baseZ;
}

/** Min center-to-center separation (%). Mild overlap OK; stacking is not. */
export const CROWD_MIN_SEP_X = 7;
export const CROWD_MIN_SEP_Y = 6;

/** Percent rects covering the desktop now-playing panel and reaction rail. */
const CROWD_UI_EXCLUSIONS = [
  // Now spinning panel — bottom-left
  { left: 0, right: 44, top: 66, bottom: 100 },
  // Quick reacts rail — bottom-right
  { left: 88, right: 100, top: 48, bottom: 90 },
] as const;

export function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function crowdColorForUser(userId: string): string {
  return CROWD_COLORS[hashUserId(userId) % CROWD_COLORS.length];
}

/** Prefer stored avatar_color; fall back to deterministic hash color. */
export function resolveUserColor(
  userId: string,
  avatarColor?: string | null
): string {
  if (avatarColor) return avatarColor;
  return crowdColorForUser(userId);
}

/** True if an avatar (center at left/top %, diameter `size` px) hits UI chrome. */
export function crowdOverlapsUiChrome(
  leftPct: number,
  topPct: number,
  size: number
): boolean {
  const halfW = ((size / 2) / VENUE_W) * 100;
  // Blob + name label roughly extend ~1.35× size downward from the anchor.
  const heightPct = ((size * 1.35) / VENUE_H) * 100;
  const left = leftPct - halfW;
  const right = leftPct + halfW;
  const top = topPct;
  const bottom = topPct + heightPct;

  return CROWD_UI_EXCLUSIONS.some(
    (zone) =>
      left < zone.right &&
      right > zone.left &&
      top < zone.bottom &&
      bottom > zone.top
  );
}

function centersTooClose(
  a: { leftPct: number; topPct: number },
  b: { leftPct: number; topPct: number },
  sepX = CROWD_MIN_SEP_X,
  sepY = CROWD_MIN_SEP_Y
): boolean {
  return (
    Math.abs(a.leftPct - b.leftPct) < sepX &&
    Math.abs(a.topPct - b.topPct) < sepY
  );
}

function crowdDepthZ(topPct: number): number {
  // Lower on the floor → higher among the crowd, but always ≤ CROWD_UI_MAX_Z.
  return Math.max(1, Math.min(CROWD_UI_MAX_Z, Math.round(topPct / 4)));
}

/** Worst-case blob diameter used when testing chrome / neighbor clearance. */
export const CROWD_PLACE_SIZE = 64;

export const CROWD_FLOOR = {
  leftMin: 11,
  leftMax: 86,
  topMin: 48,
  topMax: 84,
  frontTopGate: 66,
  frontLeftMin: 46,
} as const;

export function isValidCrowdFloorPosition(
  leftPct: number,
  topPct: number,
  size: number = CROWD_PLACE_SIZE
): boolean {
  if (
    leftPct < CROWD_FLOOR.leftMin ||
    leftPct > CROWD_FLOOR.leftMax ||
    topPct < CROWD_FLOOR.topMin ||
    topPct > CROWD_FLOOR.topMax
  ) {
    return false;
  }
  if (topPct >= CROWD_FLOOR.frontTopGate && leftPct < CROWD_FLOOR.frontLeftMin) {
    return false;
  }
  return !crowdOverlapsUiChrome(leftPct, topPct, size);
}

export function clampCrowdFloorPosition(
  leftPct: number,
  topPct: number,
  size: number = CROWD_PLACE_SIZE
): { leftPct: number; topPct: number } {
  let left = Math.min(CROWD_FLOOR.leftMax, Math.max(CROWD_FLOOR.leftMin, leftPct));
  let top = Math.min(CROWD_FLOOR.topMax, Math.max(CROWD_FLOOR.topMin, topPct));
  if (top >= CROWD_FLOOR.frontTopGate && left < CROWD_FLOOR.frontLeftMin) {
    left = CROWD_FLOOR.frontLeftMin;
  }
  if (isValidCrowdFloorPosition(left, top, size)) {
    return { leftPct: left, topPct: top };
  }
  // Spiral search for nearest valid seat (step 2%).
  for (let radius = 2; radius <= 40; radius += 2) {
    for (let dx = -radius; dx <= radius; dx += 2) {
      for (let dy = -radius; dy <= radius; dy += 2) {
        const cand = {
          leftPct: left + dx,
          topPct: top + dy,
        };
        let cl = Math.min(
          CROWD_FLOOR.leftMax,
          Math.max(CROWD_FLOOR.leftMin, cand.leftPct)
        );
        let ct = Math.min(
          CROWD_FLOOR.topMax,
          Math.max(CROWD_FLOOR.topMin, cand.topPct)
        );
        if (ct >= CROWD_FLOOR.frontTopGate && cl < CROWD_FLOOR.frontLeftMin) {
          cl = CROWD_FLOOR.frontLeftMin;
        }
        if (isValidCrowdFloorPosition(cl, ct, size)) {
          return { leftPct: cl, topPct: ct };
        }
      }
    }
  }
  return { leftPct: 55, topPct: 58 };
}

export type CrowdPos = { leftPct: number; topPct: number };

export function crowdPosStorageKey(roomSlug: string): string {
  return `needle:crowd-pos:${roomSlug}`;
}

export function parseCrowdPos(
  raw: string | null,
  size: number = CROWD_PLACE_SIZE
): CrowdPos | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<CrowdPos>;
    if (
      typeof data.leftPct !== "number" ||
      typeof data.topPct !== "number" ||
      !Number.isFinite(data.leftPct) ||
      !Number.isFinite(data.topPct)
    ) {
      return null;
    }
    if (!isValidCrowdFloorPosition(data.leftPct, data.topPct, size)) {
      return null;
    }
    return { leftPct: data.leftPct, topPct: data.topPct };
  } catch {
    return null;
  }
}

export function loadCrowdPos(
  roomSlug: string,
  size: number = CROWD_PLACE_SIZE
): CrowdPos | null {
  if (typeof window === "undefined") return null;
  try {
    return parseCrowdPos(localStorage.getItem(crowdPosStorageKey(roomSlug)), size);
  } catch {
    return null;
  }
}

export function saveCrowdPos(roomSlug: string, pos: CrowdPos): void {
  if (typeof window === "undefined") return;
  const clamped = clampCrowdFloorPosition(pos.leftPct, pos.topPct);
  try {
    localStorage.setItem(
      crowdPosStorageKey(roomSlug),
      JSON.stringify(clamped)
    );
  } catch {
    // ignore quota / private mode
  }
}

type CrowdSlot = {
  leftPct: number;
  topPct: number;
  size: number;
  dance: boolean;
};

function tryTakeSlot(
  candidate: CrowdSlot,
  taken: CrowdSlot[],
  sepX = CROWD_MIN_SEP_X,
  sepY = CROWD_MIN_SEP_Y
): boolean {
  if (
    crowdOverlapsUiChrome(
      candidate.leftPct,
      candidate.topPct,
      Math.max(candidate.size, CROWD_PLACE_SIZE)
    )
  ) {
    return false;
  }
  if (taken.some((s) => centersTooClose(s, candidate, sepX, sepY))) {
    return false;
  }
  taken.push(candidate);
  return true;
}

/** Spaced brick rows across the dance floor (back → front). */
function buildBrickSlots(count: number): CrowdSlot[] {
  const taken: CrowdSlot[] = [];

  const fill = (sepX: number, sepY: number, topMax: number) => {
    for (let top = 48, row = 0; top <= topMax && taken.length < count; top += sepY, row += 1) {
      const leftMin = top >= 66 ? 46 : 11;
      const leftMax = 86;
      const stagger = row % 2 === 1 ? sepX / 2 : 0;
      for (
        let left = leftMin + stagger;
        left <= leftMax && taken.length < count;
        left += sepX
      ) {
        const seed = Math.round(left * 10 + top * 3 + row * 17);
        tryTakeSlot(
          {
            leftPct: left,
            topPct: top,
            size: 44 + (seed % 20),
            dance: (seed & 1) === 1,
          },
          taken,
          sepX,
          sepY
        );
      }
    }
  };

  // Full minimum separation first; only tighten if the floor is saturated.
  fill(CROWD_MIN_SEP_X, CROWD_MIN_SEP_Y, 84);
  if (taken.length < count) {
    fill(CROWD_MIN_SEP_X, CROWD_MIN_SEP_Y, 88);
  }

  return taken;
}

/**
 * Small rooms keep the hand-authored CROWD_SPEC scatter. Larger rooms use a
 * brick-row grid so overflow listeners never stack on the same spot.
 */
function buildCrowdSlots(count: number): CrowdSlot[] {
  if (count <= CROWD_SPEC.length) {
    const taken: CrowdSlot[] = [];
    for (let i = 0; i < count; i++) {
      const spec = CROWD_SPEC[i];
      tryTakeSlot(
        {
          leftPct: (spec.x / VENUE_W) * 100,
          topPct: (spec.y / VENUE_H) * 100,
          size: spec.s,
          dance: spec.dance,
        },
        taken
      );
    }
    if (taken.length < count) {
      for (const slot of buildBrickSlots(count)) {
        if (taken.length >= count) break;
        tryTakeSlot(slot, taken);
      }
    }
    return taken;
  }

  return buildBrickSlots(count);
}

export interface CrowdLayoutItem {
  userId: string;
  leftPct: number;
  topPct: number;
  size: number;
  dance: boolean;
  zIndex: number;
  animDuration: number;
}

export function assignCrowdLayout(listenerIds: string[]): CrowdLayoutItem[] {
  const slots = buildCrowdSlots(listenerIds.length);

  return listenerIds.map((userId, i) => {
    const h = hashUserId(userId);
    const slot = slots[i];

    if (!slot) {
      // Floor saturated — still space by index rather than stacking in the center.
      const leftPct = 46 + (i % 5) * CROWD_MIN_SEP_X;
      const topPct = 48 + Math.floor(i / 5) * CROWD_MIN_SEP_Y;
      const size = 44 + (h % 20);
      const dance = (h & 1) === 1;
      return {
        userId,
        leftPct,
        topPct,
        size,
        dance,
        zIndex: crowdDepthZ(topPct),
        animDuration: dance ? 1.7 + i * 0.1 : 3 + i * 0.18,
      };
    }

    return {
      userId,
      leftPct: slot.leftPct,
      topPct: slot.topPct,
      size: slot.size,
      dance: slot.dance,
      zIndex: crowdDepthZ(slot.topPct),
      animDuration: slot.dance ? 1.7 + i * 0.1 : 3 + i * 0.18,
    };
  });
}
