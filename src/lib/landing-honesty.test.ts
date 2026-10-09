import { describe, expect, it } from "vitest";
import {
  formatListenerCount,
  heroDeckLabel,
  landingMarquee,
} from "./landing-honesty";

describe("formatListenerCount", () => {
  it("renders zero as 0", () => {
    expect(formatListenerCount(0)).toBe("0");
  });

  it("renders a real total with separators", () => {
    expect(formatListenerCount(1204)).toBe("1,204");
  });

  it("rejects a missing total", () => {
    expect(formatListenerCount(Number.NaN)).toBe("0");
    expect(formatListenerCount(-3)).toBe("0");
  });
});

describe("landingMarquee", () => {
  it("does not invent a song when nothing is spinning", () => {
    expect(landingMarquee(null)).toBe("THE BOOTH IS OPEN · ");
  });

  it("uses the room's real track", () => {
    expect(
      landingMarquee({
        name: "Late Night Indie Funeral",
        current_track: { title: "Nightswimming", artist: "R.E.M." },
      })
    ).toBe("NOW SPINNING · Nightswimming — R.E.M. · Late Night Indie Funeral · ");
  });
});

describe("heroDeckLabel", () => {
  it("hides the deck pill when the booth is empty", () => {
    expect(heroDeckLabel(null)).toBeNull();
  });

  it("names the real DJ", () => {
    expect(
      heroDeckLabel({
        current_track: { title: "x" },
        current_dj: { display_name: "mossy" },
      })
    ).toBe("mossy · ON DECK");
  });

  it("says House when a track is playing with no DJ", () => {
    expect(
      heroDeckLabel({ current_track: { title: "x" }, current_dj: null })
    ).toBe("House · SPINNING");
  });
});
