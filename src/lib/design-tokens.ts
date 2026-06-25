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

export interface CrowdLayoutItem {
  userId: string;
  leftPct: number;
  topPct: number;
  size: number;
  dance: boolean;
  reactGlyph: string;
  reactColor: string;
  zIndex: number;
  animDuration: number;
  showReact: boolean;
}

export function assignCrowdLayout(
  listenerIds: string[],
  energy: number
): CrowdLayoutItem[] {
  const reactN = Math.floor(energy / 16);
  const speed = 1 - energy / 100;

  return listenerIds.map((userId, i) => {
    const spec = CROWD_SPEC[i % CROWD_SPEC.length];
    const h = hashUserId(userId);
    const color = crowdColorForUser(userId);

    let leftPct: number;
    let topPct: number;
    let size: number;
    let dance: boolean;

    if (i < CROWD_SPEC.length) {
      leftPct = (spec.x / VENUE_W) * 100;
      topPct = (spec.y / VENUE_H) * 100;
      size = spec.s;
      dance = spec.dance;
    } else {
      leftPct = 10 + (h % 80);
      topPct = 52 + ((h >> 5) % 35);
      size = 44 + (h % 20);
      dance = (h & 1) === 1;
    }

    return {
      userId,
      leftPct,
      topPct,
      size,
      dance,
      reactGlyph: REACT_GLYPHS[i % REACT_GLYPHS.length],
      reactColor: color,
      zIndex: Math.round((i < CROWD_SPEC.length ? spec.y : topPct * 7)),
      animDuration: dance
        ? 1.7 * speed + i * 0.1
        : 3 * speed + i * 0.18,
      showReact: i < reactN,
    };
  });
}
