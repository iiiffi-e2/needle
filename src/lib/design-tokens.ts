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

function placeAwayFromUi(
  seed: number,
  size: number
): { leftPct: number; topPct: number } {
  for (let attempt = 0; attempt < 24; attempt++) {
    const leftPct = 12 + ((seed + attempt * 17) % 76);
    const topPct = 48 + (((seed >> 5) + attempt * 13) % 28);
    if (!crowdOverlapsUiChrome(leftPct, topPct, size)) {
      return { leftPct, topPct };
    }
  }
  // Safe center-floor fallback if hash probes all land in chrome.
  return {
    leftPct: 48 + (seed % 16),
    topPct: 54 + ((seed >> 3) % 10),
  };
}

function crowdDepthZ(topPct: number): number {
  // Lower on the floor → higher among the crowd, but always ≤ CROWD_UI_MAX_Z.
  return Math.max(1, Math.min(CROWD_UI_MAX_Z, Math.round(topPct / 4)));
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
  return listenerIds.map((userId, i) => {
    const spec = CROWD_SPEC[i % CROWD_SPEC.length];
    const h = hashUserId(userId);

    let leftPct: number;
    let topPct: number;
    let size: number;
    let dance: boolean;

    if (i < CROWD_SPEC.length) {
      leftPct = (spec.x / VENUE_W) * 100;
      topPct = (spec.y / VENUE_H) * 100;
      size = spec.s;
      dance = spec.dance;
      if (crowdOverlapsUiChrome(leftPct, topPct, size)) {
        ({ leftPct, topPct } = placeAwayFromUi(h ^ (i * 97), size));
      }
    } else {
      size = 44 + (h % 20);
      dance = (h & 1) === 1;
      ({ leftPct, topPct } = placeAwayFromUi(h ^ (i * 31), size));
    }

    return {
      userId,
      leftPct,
      topPct,
      size,
      dance,
      zIndex: crowdDepthZ(topPct),
      animDuration: dance ? 1.7 + i * 0.1 : 3 + i * 0.18,
    };
  });
}
