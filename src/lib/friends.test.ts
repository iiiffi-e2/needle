import { describe, expect, it } from "vitest";
import {
  DECLINE_COOLDOWN_MS,
  canonicalPair,
  getRelationshipHint,
  isDeclineCooldownActive,
  validateSendRequest,
} from "./friends";

describe("canonicalPair", () => {
  it("orders UUIDs lexicographically", () => {
    const a = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const c = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    expect(canonicalPair(a, c)).toEqual([c, a]);
    expect(canonicalPair(c, a)).toEqual([c, a]);
  });
});

describe("isDeclineCooldownActive", () => {
  it("returns true within 72 hours", () => {
    const now = Date.parse("2026-07-06T12:00:00.000Z");
    const declinedAt = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    expect(isDeclineCooldownActive(declinedAt, now)).toBe(true);
  });

  it("returns false after 72 hours", () => {
    const now = Date.parse("2026-07-06T12:00:00.000Z");
    const declinedAt = new Date(now - DECLINE_COOLDOWN_MS - 1000).toISOString();
    expect(isDeclineCooldownActive(declinedAt, now)).toBe(false);
  });

  it("returns false when declined_at is null", () => {
    expect(isDeclineCooldownActive(null)).toBe(false);
  });
});

describe("getRelationshipHint", () => {
  const me = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const them = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  it("returns none when no relationship", () => {
    expect(getRelationshipHint(null, me)).toBe("none");
  });

  it("returns pending_out when I sent request", () => {
    expect(
      getRelationshipHint({ status: "pending", requested_by: me }, me)
    ).toBe("pending_out");
  });

  it("returns pending_in when they sent request", () => {
    expect(
      getRelationshipHint({ status: "pending", requested_by: them }, me)
    ).toBe("pending_in");
  });

  it("returns friends when accepted", () => {
    expect(
      getRelationshipHint({ status: "accepted", requested_by: me }, me)
    ).toBe("friends");
  });
});

describe("validateSendRequest", () => {
  const me = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const them = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
  const now = Date.parse("2026-07-06T12:00:00.000Z");

  it("rejects self-request", () => {
    const result = validateSendRequest({
      fromId: me,
      toId: me,
      relationship: null,
      nowMs: now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("rejects when already friends", () => {
    const result = validateSendRequest({
      fromId: me,
      toId: them,
      relationship: {
        status: "accepted",
        requested_by: me,
        declined_at: null,
      },
      nowMs: now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(409);
  });

  it("rejects duplicate pending from same sender", () => {
    const result = validateSendRequest({
      fromId: me,
      toId: them,
      relationship: {
        status: "pending",
        requested_by: me,
        declined_at: null,
      },
      nowMs: now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("already sent");
  });

  it("rejects within decline cooldown", () => {
    const result = validateSendRequest({
      fromId: me,
      toId: them,
      relationship: {
        status: "declined",
        requested_by: me,
        declined_at: new Date(now - 60 * 60 * 1000).toISOString(),
      },
      nowMs: now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(429);
  });

  it("allows re-request after cooldown", () => {
    const result = validateSendRequest({
      fromId: me,
      toId: them,
      relationship: {
        status: "declined",
        requested_by: me,
        declined_at: new Date(now - DECLINE_COOLDOWN_MS - 1000).toISOString(),
      },
      nowMs: now,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects when blocked", () => {
    const result = validateSendRequest({
      fromId: me,
      toId: them,
      relationship: {
        status: "blocked",
        requested_by: them,
        declined_at: null,
      },
      nowMs: now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });
});
