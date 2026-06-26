import { describe, expect, it } from "vitest";
import { shouldRotateToNextDj } from "./playback";

describe("shouldRotateToNextDj", () => {
  it("does not rotate when there is only one DJ", () => {
    expect(
      shouldRotateToNextDj(["dj-a"], ["dj-a", "dj-b"], "dj-a")
    ).toBe(false);
  });

  it("does not rotate when only the current DJ has queued tracks", () => {
    expect(
      shouldRotateToNextDj(["dj-a", "dj-b", "dj-c"], ["dj-a"], "dj-a")
    ).toBe(false);
  });

  it("rotates when another booth DJ has queued tracks", () => {
    expect(
      shouldRotateToNextDj(["dj-a", "dj-b"], ["dj-a", "dj-b"], "dj-a")
    ).toBe(true);
  });

  it("ignores queued tracks from DJs not in the booth", () => {
    expect(
      shouldRotateToNextDj(["dj-a", "dj-b"], ["dj-a", "dj-c"], "dj-a")
    ).toBe(false);
  });

  it("does not rotate without a current DJ", () => {
    expect(
      shouldRotateToNextDj(["dj-a", "dj-b"], ["dj-b"], null)
    ).toBe(false);
  });
});
