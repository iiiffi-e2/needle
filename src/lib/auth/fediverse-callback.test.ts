import { describe, expect, it } from "vitest";
import { fediverseCallbackPlan, parseFediState } from "./fediverse-callback";

const cookie = {
  nonce: "nonce",
  acct: "ada@mastodon.social",
  host: "mastodon.social",
  next: "/rooms/late",
};

describe("parseFediState", () => {
  it("rejects a missing or partial cookie", () => {
    expect(parseFediState(undefined)).toBeNull();
    expect(parseFediState("{")).toBeNull();
    expect(parseFediState(JSON.stringify({ nonce: "n" }))).toBeNull();
  });
});

describe("fediverseCallbackPlan", () => {
  const base = {
    origin: "https://needle.example",
    code: "code",
    state: "nonce",
    providerError: null,
    cookie,
    account: {
      username: "ada",
      url: "https://mastodon.social/@ada",
    },
    exchangeFailed: false,
  };

  it("cancels when approval is denied or the code is missing", () => {
    expect(
      fediverseCallbackPlan({ ...base, providerError: "access_denied" })
    ).toEqual({
      location:
        "https://needle.example/auth/login?error=fedi_canceled&handle=ada%40mastodon.social",
      mint: false,
    });
    expect(fediverseCallbackPlan({ ...base, code: null }).mint).toBe(false);
  });

  it("expires a swapped or missing state and does not mint", () => {
    expect(fediverseCallbackPlan({ ...base, state: "other" })).toEqual({
      location:
        "https://needle.example/auth/login?error=fedi_expired&handle=ada%40mastodon.social",
      mint: false,
    });
    expect(fediverseCallbackPlan({ ...base, cookie: null }).location).toContain(
      "error=fedi_expired"
    );
  });

  it("refuses a mismatched account without minting", () => {
    const plan = fediverseCallbackPlan({
      ...base,
      account: { username: "ada", url: "https://other.example/@ada" },
    });
    expect(plan.mint).toBe(false);
    expect(plan.location).toContain("error=fedi_mismatch");
  });

  it("mints and returns the safe path when the account matches", () => {
    expect(fediverseCallbackPlan(base)).toEqual({
      location: "https://needle.example/rooms/late",
      mint: true,
    });
    expect(
      fediverseCallbackPlan({ ...base, cookie: { ...cookie, next: "//evil.com" } })
        .location
    ).toBe("https://needle.example/rooms");
  });
});
