import { describe, expect, it, vi } from "vitest";
import { assertPublicHost, isBlockedAddress } from "./fediverse-host";

describe("isBlockedAddress", () => {
  it("blocks private, local, and non-routable addresses", () => {
    expect(isBlockedAddress("127.0.0.1")).toBe(true);
    expect(isBlockedAddress("10.1.2.3")).toBe(true);
    expect(isBlockedAddress("192.168.1.1")).toBe(true);
    expect(isBlockedAddress("172.16.0.1")).toBe(true);
    expect(isBlockedAddress("169.254.1.1")).toBe(true);
    expect(isBlockedAddress("100.64.0.1")).toBe(true);
    expect(isBlockedAddress("::1")).toBe(true);
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
  });
});

describe("assertPublicHost", () => {
  it("accepts a host whose addresses are public", async () => {
    const lookupFn = vi.fn(async () => ["8.8.8.8"]);
    await expect(assertPublicHost("mastodon.social", lookupFn)).resolves.toBe(
      true
    );
  });

  it("rejects a host when any address is private", async () => {
    const lookupFn = vi.fn(async () => ["8.8.8.8", "10.0.0.1"]);
    await expect(assertPublicHost("mastodon.social", lookupFn)).resolves.toBe(
      false
    );
  });

  it("rejects local names without a lookup", async () => {
    const lookupFn = vi.fn(async () => ["8.8.8.8"]);
    await expect(assertPublicHost("localhost", lookupFn)).resolves.toBe(false);
    await expect(assertPublicHost("foo.local", lookupFn)).resolves.toBe(false);
    expect(lookupFn).not.toHaveBeenCalled();
  });

  it("rejects a lookup failure", async () => {
    const lookupFn = vi.fn(async () => {
      throw new Error("nxdomain");
    });
    await expect(assertPublicHost("missing.example", lookupFn)).resolves.toBe(
      false
    );
  });
});
