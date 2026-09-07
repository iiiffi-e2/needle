import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  parseStageViewMode,
  readStageViewMode,
  writeStageViewMode,
  STAGE_VIEW_STORAGE_KEY,
} from "./stage-view";

describe("parseStageViewMode", () => {
  it("defaults to full for unknown values", () => {
    expect(parseStageViewMode(null)).toBe("full");
    expect(parseStageViewMode("hidden")).toBe("full");
    expect(parseStageViewMode("")).toBe("full");
  });

  it("accepts compact and full", () => {
    expect(parseStageViewMode("compact")).toBe("compact");
    expect(parseStageViewMode("full")).toBe("full");
  });
});

describe("stage view localStorage", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads full when nothing is stored", () => {
    expect(readStageViewMode()).toBe("full");
  });

  it("persists and reads the compact preference", () => {
    writeStageViewMode("compact");
    expect(store.get(STAGE_VIEW_STORAGE_KEY)).toBe("compact");
    expect(readStageViewMode()).toBe("compact");
  });

  it("falls back to full when storage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(readStageViewMode()).toBe("full");
    expect(() => writeStageViewMode("compact")).not.toThrow();
  });
});
