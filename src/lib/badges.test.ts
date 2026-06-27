import { describe, expect, it } from "vitest";
import {
  isMidnightHour,
  isSadRoom,
  roomHasTag,
  statBadgeEligibility,
  BADGE,
} from "./badges";

describe("statBadgeEligibility", () => {
  const base = {
    tracks_played: 0,
    tracks_saved_by_others: 0,
    awesome_votes_received: 0,
    lame_votes_received: 0,
  };

  it("awards First Save after the first save received", () => {
    expect(
      statBadgeEligibility({ ...base, tracks_saved_by_others: 1 })
    ).toContain(BADGE.FIRST_SAVE);
  });

  it("awards Crowd Favorite at 10 awesome votes", () => {
    expect(
      statBadgeEligibility({ ...base, awesome_votes_received: 10 })
    ).toContain(BADGE.CROWD_FAVORITE);
  });

  it("awards Vibe Assassin with strong ratio and enough votes", () => {
    expect(
      statBadgeEligibility({
        ...base,
        awesome_votes_received: 9,
        lame_votes_received: 1,
      })
    ).toContain(BADGE.VIBE_ASSASSIN);
  });

  it("awards No-Skip Menace after five plays with no lames", () => {
    expect(
      statBadgeEligibility({
        ...base,
        tracks_played: 5,
      })
    ).toContain(BADGE.NO_SKIP_MENACE);
  });
});

describe("isMidnightHour", () => {
  it("is true between midnight and 5am UTC", () => {
    expect(isMidnightHour(new Date("2026-01-01T02:30:00Z"))).toBe(true);
    expect(isMidnightHour(new Date("2026-01-01T05:00:00Z"))).toBe(false);
  });
});

describe("room tags", () => {
  it("detects bloghouse and sad tags case-insensitively", () => {
    expect(roomHasTag(["Bloghouse", "electro"], "bloghouse")).toBe(true);
    expect(isSadRoom(["indie", "sad"], null)).toBe(true);
    expect(isSadRoom([], "melancholy hour")).toBe(true);
  });
});
