import { describe, expect, it } from "vitest";
import {
  distributeStressCounts,
  validateStressStartInput,
  MAX_STRESS_LISTENERS,
} from "./stress-test";
import {
  ensureUniqueDisplayName,
  generateStressDisplayName,
} from "./stress-bot-names";

describe("distributeStressCounts", () => {
  it("puts all in one room", () => {
    expect(distributeStressCounts(100, ["a"])).toEqual({ a: 100 });
  });

  it("splits 80/20 for two rooms", () => {
    expect(distributeStressCounts(100, ["a", "b"])).toEqual({ a: 80, b: 20 });
  });

  it("splits 80/10/10 for three rooms with remainder on primary", () => {
    expect(distributeStressCounts(101, ["a", "b", "c"])).toEqual({
      a: 81,
      b: 10,
      c: 10,
    });
  });
});

describe("validateStressStartInput", () => {
  it("accepts valid input with defaults", () => {
    const r = validateStressStartInput({
      primaryRoomSlug: "lofi",
      totalListeners: 10,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.ttlMinutes).toBe(20);
      expect(r.mode).toBe("presence");
    }
  });

  it("rejects over max listeners", () => {
    const r = validateStressStartInput({
      primaryRoomSlug: "lofi",
      totalListeners: MAX_STRESS_LISTENERS + 1,
    });
    expect(r.ok).toBe(false);
  });

  it("rejects realtime mode in v1", () => {
    const r = validateStressStartInput({
      primaryRoomSlug: "lofi",
      totalListeners: 5,
      mode: "realtime",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects more than 2 secondaries", () => {
    const r = validateStressStartInput({
      primaryRoomSlug: "a",
      secondaryRoomSlugs: ["b", "c", "d"],
      totalListeners: 5,
    });
    expect(r.ok).toBe(false);
  });
});

describe("generateStressDisplayName", () => {
  it("returns AdjNoun form", () => {
    const name = generateStressDisplayName(() => 0);
    expect(name).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+$/);
  });

  it("ensureUniqueDisplayName suffixes on collision", () => {
    const taken = new Set(["VoidMoth"]);
    const next = ensureUniqueDisplayName("VoidMoth", taken, () => 0.5);
    expect(next).not.toBe("VoidMoth");
    expect(next.startsWith("VoidMoth")).toBe(true);
  });
});
