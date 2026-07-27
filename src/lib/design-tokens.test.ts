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
  slideCrowdFloorPosition,
} from "./design-tokens";

/** IDs that hash into the bottom-left / bottom-right under the old overflow formula. */
const CROWDED_ROOM_IDS = Array.from({ length: 40 }, (_, i) => `stress-user-${i}`);

function stackedPairCount(
  layout: { leftPct: number; topPct: number }[]
): number {
  let close = 0;
  // Slightly softer than placement sep so late-round pack-ins aren't false fails.
  const sepX = CROWD_MIN_SEP_X * 0.8;
  const sepY = CROWD_MIN_SEP_Y * 0.8;
  for (let i = 0; i < layout.length; i++) {
    for (let j = i + 1; j < layout.length; j++) {
      const dx = Math.abs(layout[i].leftPct - layout[j].leftPct);
      const dy = Math.abs(layout[i].topPct - layout[j].topPct);
      if (dx < sepX && dy < sepY) close += 1;
    }
  }
  return close;
}

describe("crowdZIndexForMember", () => {
  it("self wins z-index over neighbors while others keep base", () => {
    expect(crowdZIndexForMember(3, true)).toBe(CROWD_UI_MAX_Z);
    expect(crowdZIndexForMember(3, false)).toBe(3);
  });

  it("focused peers sit just under self and above the crowd", () => {
    expect(crowdZIndexForMember(3, false, true)).toBe(CROWD_UI_MAX_Z - 1);
    expect(crowdZIndexForMember(3, true, true)).toBe(CROWD_UI_MAX_Z);
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

  it("scatters across the floor instead of a uniform center block", () => {
    const layout = assignCrowdLayout(CROWDED_ROOM_IDS);
    const lefts = layout.map((l) => l.leftPct);
    const tops = layout.map((l) => l.topPct);
    expect(Math.min(...lefts)).toBeLessThan(25);
    expect(Math.max(...lefts)).toBeGreaterThan(70);
    expect(Math.min(...tops)).toBeLessThan(50);
    const roundedTops = new Set(tops.map((t) => Math.round(t * 2) / 2));
    expect(roundedTops.size).toBeGreaterThan(8);
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

  it("keeps front-row pointer aims out of the player zone", () => {
    const pos = clampCrowdFloorPosition(20, 72);
    expect(isValidCrowdFloorPosition(pos.leftPct, pos.topPct)).toBe(true);
    // Either stay above the gate or shift right of the player — never both wrong.
    expect(
      pos.topPct < CROWD_FLOOR.frontTopGate ||
        pos.leftPct >= CROWD_FLOOR.frontLeftMin
    ).toBe(true);
  });

  it("slides continuously along a drag path through the player corner", () => {
    let from = { leftPct: 30, topPct: 55 };
    const path = [58, 62, 66, 70, 74, 78].map((top) => {
      from = slideCrowdFloorPosition(30, top, from);
      return from;
    });
    for (let i = 1; i < path.length; i++) {
      const jump = Math.hypot(
        path[i].leftPct - path[i - 1].leftPct,
        path[i].topPct - path[i - 1].topPct
      );
      expect(jump).toBeLessThan(10);
      expect(
        isValidCrowdFloorPosition(path[i].leftPct, path[i].topPct)
      ).toBe(true);
    }
  });

  it("does not hard-jump when crossing the front-row gate vertically", () => {
    const above = clampCrowdFloorPosition(30, 64);
    const below = clampCrowdFloorPosition(30, 68);
    const jump = Math.hypot(
      below.leftPct - above.leftPct,
      below.topPct - above.topPct
    );
    expect(jump).toBeLessThan(12);
    expect(isValidCrowdFloorPosition(above.leftPct, above.topPct)).toBe(true);
    expect(isValidCrowdFloorPosition(below.leftPct, below.topPct)).toBe(true);
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
