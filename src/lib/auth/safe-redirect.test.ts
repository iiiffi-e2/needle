import { describe, expect, it } from "vitest";
import { oauthRedirectTo, safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("allows needle paths", () => {
    expect(safeRedirectPath("/rooms")).toBe("/rooms");
    expect(safeRedirectPath("/rooms/a?x=1")).toBe("/rooms/a?x=1");
  });

  it("replaces off-site and empty values with /rooms", () => {
    expect(safeRedirectPath("//evil.com")).toBe("/rooms");
    expect(safeRedirectPath("/\\evil")).toBe("/rooms");
    expect(safeRedirectPath("https://evil.com")).toBe("/rooms");
    expect(safeRedirectPath("")).toBe("/rooms");
    expect(safeRedirectPath(null)).toBe("/rooms");
    expect(safeRedirectPath(undefined)).toBe("/rooms");
  });
});

describe("oauthRedirectTo", () => {
  it("puts the safe path on the auth callback", () => {
    expect(oauthRedirectTo("/rooms")).toBe(
      "http://localhost:3000/auth/callback?next=%2Frooms"
    );
    expect(oauthRedirectTo("//evil.com")).toBe(
      "http://localhost:3000/auth/callback?next=%2Frooms"
    );
    expect(oauthRedirectTo(null)).toBe(
      "http://localhost:3000/auth/callback?next=%2Frooms"
    );
  });
});
