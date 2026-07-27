import { describe, expect, it } from "vitest";
import {
  assignCrowdLayout,
  CROWD_SPEC,
  CROWD_UI_MAX_Z,
  crowdOverlapsUiChrome,
} from "./design-tokens";

/** IDs that hash into the bottom-left / bottom-right under the old overflow formula. */
const CROWDED_ROOM_IDS = Array.from({ length: 40 }, (_, i) => `stress-user-${i}`);

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

  it("still places the first listeners on the designed crowd spots when clear", () => {
    const ids = CROWD_SPEC.map((_, i) => `seed-${i}`);
    const layout = assignCrowdLayout(ids);
    expect(layout).toHaveLength(CROWD_SPEC.length);
    expect(layout[0]?.userId).toBe("seed-0");
    expect(layout.every((item) => item.leftPct > 0 && item.topPct > 0)).toBe(
      true
    );
  });
});
