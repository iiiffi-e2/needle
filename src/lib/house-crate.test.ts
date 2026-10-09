import { describe, expect, it } from "vitest";
import { pickHouseTrack } from "./house-crate";

describe("pickHouseTrack", () => {
  it("returns null when the room has never played anything", () => {
    expect(pickHouseTrack([], null)).toBeNull();
  });

  it("picks the track that has been quiet the longest", () => {
    const id = pickHouseTrack(
      [
        { trackId: "new", playedAt: "2026-10-08T21:00:00.000Z" },
        { trackId: "old", playedAt: "2026-10-08T18:00:00.000Z" },
        { trackId: "old", playedAt: "2026-10-08T19:00:00.000Z" },
      ],
      "new"
    );
    expect(id).toBe("old");
  });

  it("does not immediately replay the track that just finished when another exists", () => {
    const id = pickHouseTrack(
      [
        { trackId: "just", playedAt: "2026-10-08T21:00:00.000Z" },
        { trackId: "other", playedAt: "2026-10-08T20:00:00.000Z" },
      ],
      "just"
    );
    expect(id).toBe("other");
  });

  it("replays the only track the room has", () => {
    expect(
      pickHouseTrack(
        [{ trackId: "only", playedAt: "2026-10-08T21:00:00.000Z" }],
        "only"
      )
    ).toBe("only");
  });
});
