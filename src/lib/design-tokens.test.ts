import { describe, expect, it, vi } from "vitest";
import {
  assignCrowdLayout,
  clampCrowdFloorPosition,
  CROWD_FLOOR,
  CROWD_MIN_SEP_X,
  CROWD_MIN_SEP_Y,
  CROWD_SPEC,
  CROWD_UI_MAX_Z,
  crowdOverlapsUiChrome,
  crowdPosStorageKey,
  crowdZIndexForMember,
  isValidCrowdFloorPosition,
  loadCrowdPos,
  parseCrowdPos,
  saveCrowdPos,
} from "./design-tokens";

/** IDs that hash into the bottom-left / bottom-right under the old overflow formula. */
const CROWDED_ROOM_IDS = Array.from({ length: 40 }, (_, i) => `stress-user-${i}`);

function stackedPairCount(
  layout: { leftPct: number; topPct: number }[]
): number {
  let close = 0;
  for (let i = 0; i < layout.length; i++) {
    for (let j = i + 1; j < layout.length; j++) {
      const dx = Math.abs(layout[i].leftPct - layout[j].leftPct);
      const dy = Math.abs(layout[i].topPct - layout[j].topPct);
      if (dx < CROWD_MIN_SEP_X && dy < CROWD_MIN_SEP_Y) close += 1;
    }
  }
  return close;
}

describe("crowdZIndexForMember", () => {
  it("self wins z-index over neighbors while others keep base", () => {
    expect(crowdZIndexForMember(3, true)).toBe(CROWD_UI_MAX_Z);
    expect(crowdZIndexForMember(3, false)).toBe(3);
  });
});

describe("assignCrowdLayout", () => {
  it("keeps crowd z-index below the now-playing / reacts UI layer", () => {
    const layout = assignCrowdLayout(CROWDED_ROOM_IDS);
    for (const item of layout) {
      expect(item.zIndex).toBeGreaterThanOrEqual(1);
      expect(item.zIndex).toBeLessThanOrEqual(CROWD_UI_MAX_Z);
    }
  });

  it("does not place avatars over the player or reaction rail", () => {
    const layout = assignCrowdLayout(CROWDED_ROOM_IDS);
    for (const item of layout) {
      expect(crowdOverlapsUiChrome(item.leftPct, item.topPct, item.size)).toBe(
        false
      );
    }
  });

  it("spreads listeners so they are not stacked on the same spot", () => {
    const layout = assignCrowdLayout(CROWDED_ROOM_IDS);
    expect(stackedPairCount(layout)).toBe(0);
  });

  it("still places the first listeners on the designed crowd spots when clear", () => {
    const ids = CROWD_SPEC.map((_, i) => `seed-${i}`);
    const layout = assignCrowdLayout(ids);
    expect(layout).toHaveLength(CROWD_SPEC.length);
    expect(layout[0]?.userId).toBe("seed-0");
    // Designed back-row spot should stay put when it clears UI chrome.
    expect(layout[0]?.leftPct).toBeCloseTo((CROWD_SPEC[0].x / 940) * 100, 5);
    expect(layout[0]?.topPct).toBeCloseTo((CROWD_SPEC[0].y / 716) * 100, 5);
  });
});

describe("crowd floor position", () => {
  it("rejects positions over the now-playing panel", () => {
    expect(isValidCrowdFloorPosition(20, 80)).toBe(false);
  });

  it("rejects positions over the reaction rail", () => {
    expect(isValidCrowdFloorPosition(95, 60)).toBe(false);
  });

  it("accepts a mid-floor seat", () => {
    expect(isValidCrowdFloorPosition(55, 58)).toBe(true);
  });

  it("clamps into the floor envelope and out of chrome", () => {
    const pos = clampCrowdFloorPosition(5, 90);
    expect(pos.leftPct).toBeGreaterThanOrEqual(CROWD_FLOOR.leftMin);
    expect(pos.leftPct).toBeLessThanOrEqual(CROWD_FLOOR.leftMax);
    expect(pos.topPct).toBeGreaterThanOrEqual(CROWD_FLOOR.topMin);
    expect(pos.topPct).toBeLessThanOrEqual(CROWD_FLOOR.topMax);
    expect(isValidCrowdFloorPosition(pos.leftPct, pos.topPct)).toBe(true);
  });

  it("forces front-row seats right of the player zone", () => {
    const pos = clampCrowdFloorPosition(20, 72);
    expect(pos.leftPct).toBeGreaterThanOrEqual(CROWD_FLOOR.frontLeftMin);
    expect(isValidCrowdFloorPosition(pos.leftPct, pos.topPct)).toBe(true);
  });
});

describe("crowd pos storage", () => {
  it("builds the per-room storage key", () => {
    expect(crowdPosStorageKey("first-room")).toBe("needle:crowd-pos:first-room");
  });

  it("parseCrowdPos returns null for invalid JSON", () => {
    expect(parseCrowdPos("nope")).toBeNull();
    expect(parseCrowdPos(null)).toBeNull();
    expect(parseCrowdPos("{}")).toBeNull();
  });

  it("parseCrowdPos accepts valid coords and rejects chrome hits", () => {
    expect(parseCrowdPos(JSON.stringify({ leftPct: 55, topPct: 58 }))).toEqual({
      leftPct: 55,
      topPct: 58,
    });
    expect(parseCrowdPos(JSON.stringify({ leftPct: 20, topPct: 80 }))).toBeNull();
  });

  it("saveCrowdPos + loadCrowdPos round-trip in localStorage", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    });
    vi.stubGlobal("window", {});

    const slug = "test-room-pos";
    localStorage.removeItem(crowdPosStorageKey(slug));
    saveCrowdPos(slug, { leftPct: 60, topPct: 62 });
    expect(loadCrowdPos(slug)).toEqual({ leftPct: 60, topPct: 62 });
    localStorage.removeItem(crowdPosStorageKey(slug));

    vi.unstubAllGlobals();
  });
});
