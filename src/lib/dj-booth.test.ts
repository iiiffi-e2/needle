import { describe, expect, it } from "vitest";
import {
  PRESENCE_WINDOW_MS,
  isMemberPresent,
  shouldJoinWaitlist,
  pickNextWaitlistEntry,
  type WaitlistCandidate,
} from "./dj-booth";

describe("isMemberPresent", () => {
  it("returns true when last_seen is within 5 minutes", () => {
    const now = Date.parse("2026-06-26T12:00:00.000Z");
    const lastSeen = new Date(now - 4 * 60 * 1000).toISOString();
    expect(isMemberPresent(lastSeen, now)).toBe(true);
  });

  it("returns false when last_seen is older than 5 minutes", () => {
    const now = Date.parse("2026-06-26T12:00:00.000Z");
    const lastSeen = new Date(now - PRESENCE_WINDOW_MS - 1000).toISOString();
    expect(isMemberPresent(lastSeen, now)).toBe(false);
  });
});

describe("shouldJoinWaitlist", () => {
  it("returns false when slots open and waitlist empty", () => {
    expect(shouldJoinWaitlist(2, 3, 0)).toBe(false);
  });

  it("returns true when booth is full", () => {
    expect(shouldJoinWaitlist(3, 3, 0)).toBe(true);
  });

  it("returns true when waitlist has entries even if slot open", () => {
    expect(shouldJoinWaitlist(2, 3, 1)).toBe(true);
  });
});

describe("pickNextWaitlistEntry", () => {
  const entries: WaitlistCandidate[] = [
    { id: "w1", user_id: "u1", position: 0 },
    { id: "w2", user_id: "u2", position: 1 },
    { id: "w3", user_id: "u3", position: 2 },
  ];

  it("returns first entry whose user is present", () => {
    const result = pickNextWaitlistEntry(entries, new Set(["u2", "u3"]));
    expect(result).toEqual({
      promote: entries[1],
      staleIds: ["w1"],
    });
  });

  it("returns null promote and all stale when nobody present", () => {
    const result = pickNextWaitlistEntry(entries, new Set());
    expect(result.promote).toBeNull();
    expect(result.staleIds).toEqual(["w1", "w2", "w3"]);
  });
});
