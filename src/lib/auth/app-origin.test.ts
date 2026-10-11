import { describe, expect, it } from "vitest";
import {
  fediverseAppStorageKey,
  fediverseRedirectUri,
  resolveAppOrigin,
} from "./app-origin";

describe("resolveAppOrigin", () => {
  it("prefers the configured URL and strips a trailing slash", () => {
    expect(
      resolveAppOrigin("https://needle.example/", "http://localhost:3000")
    ).toBe("https://needle.example");
  });

  it("uses the request origin when no app URL is set", () => {
    expect(resolveAppOrigin(undefined, "http://localhost:3000")).toBe(
      "http://localhost:3000"
    );
    expect(resolveAppOrigin("  ", "http://localhost:3000")).toBe(
      "http://localhost:3000"
    );
  });

  it("adds https when the configured host has no scheme", () => {
    expect(resolveAppOrigin("onneedle.com", "http://localhost:3000")).toBe(
      "https://onneedle.com"
    );
    expect(resolveAppOrigin("onneedle.com/", "https://www.onneedle.com")).toBe(
      "https://onneedle.com"
    );
  });
});

describe("fediverseRedirectUri", () => {
  it("points at the needle callback", () => {
    expect(fediverseRedirectUri("https://needle.example")).toBe(
      "https://needle.example/auth/fediverse/callback"
    );
  });
});

describe("fediverseAppStorageKey", () => {
  it("keeps each redirect address as its own registration", () => {
    expect(
      fediverseAppStorageKey(
        "mastodon.social",
        "https://onneedle.com/auth/fediverse/callback"
      )
    ).toBe(
      "mastodon.social https://onneedle.com/auth/fediverse/callback"
    );
  });
});
