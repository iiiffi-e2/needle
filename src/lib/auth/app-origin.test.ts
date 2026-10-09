import { describe, expect, it } from "vitest";
import { fediverseRedirectUri, resolveAppOrigin } from "./app-origin";

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
});

describe("fediverseRedirectUri", () => {
  it("points at the needle callback", () => {
    expect(fediverseRedirectUri("https://needle.example")).toBe(
      "https://needle.example/auth/fediverse/callback"
    );
  });
});
