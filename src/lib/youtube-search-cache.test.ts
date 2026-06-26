import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getCachedSearchResults,
  setCachedSearchResults,
  checkSearchRateLimit,
  type YouTubeSearchResult,
} from "./youtube-search-cache";

const sample: YouTubeSearchResult[] = [
  {
    videoId: "abc12345678",
    title: "Test Track",
    thumbnailUrl: "https://example.com/thumb.jpg",
    channelTitle: "Test Channel",
  },
];

describe("youtube-search-cache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("returns null for uncached query", () => {
    expect(getCachedSearchResults("never searched")).toBeNull();
  });

  it("returns cached results within TTL", () => {
    setCachedSearchResults("daft punk", sample);
    expect(getCachedSearchResults("daft punk")).toEqual(sample);
  });

  it("expires cache after 1 hour", () => {
    setCachedSearchResults("daft punk", sample);
    vi.advanceTimersByTime(60 * 60 * 1000 + 1);
    expect(getCachedSearchResults("daft punk")).toBeNull();
  });

  it("normalizes query keys (trim + lowercase)", () => {
    setCachedSearchResults("  Daft Punk  ", sample);
    expect(getCachedSearchResults("daft punk")).toEqual(sample);
  });

  it("allows requests under rate limit", () => {
    const userId = "user-1";
    for (let i = 0; i < 20; i++) {
      expect(checkSearchRateLimit(userId)).toBe(true);
    }
  });

  it("blocks requests over rate limit", () => {
    const userId = "user-2";
    for (let i = 0; i < 20; i++) {
      checkSearchRateLimit(userId);
    }
    expect(checkSearchRateLimit(userId)).toBe(false);
  });

  it("resets rate limit after 1 minute", () => {
    const userId = "user-3";
    for (let i = 0; i < 20; i++) {
      checkSearchRateLimit(userId);
    }
    expect(checkSearchRateLimit(userId)).toBe(false);
    vi.advanceTimersByTime(60 * 1000 + 1);
    expect(checkSearchRateLimit(userId)).toBe(true);
  });
});
