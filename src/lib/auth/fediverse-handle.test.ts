import { describe, expect, it } from "vitest";
import { parseFediverseHandle } from "./fediverse-handle";

describe("parseFediverseHandle", () => {
  it("accepts a handle, a leading @, and profile URLs", () => {
    expect(parseFediverseHandle("Name@Mastodon.Social")).toEqual({
      username: "name",
      host: "mastodon.social",
      acct: "name@mastodon.social",
    });
    expect(parseFediverseHandle("@name@mastodon.social")).toEqual({
      username: "name",
      host: "mastodon.social",
      acct: "name@mastodon.social",
    });
    expect(parseFediverseHandle("https://mastodon.social/@name/")).toEqual({
      username: "name",
      host: "mastodon.social",
      acct: "name@mastodon.social",
    });
    expect(parseFediverseHandle("https://mastodon.social/users/name")).toEqual({
      username: "name",
      host: "mastodon.social",
      acct: "name@mastodon.social",
    });
  });

  it("rejects forms that are not a home-server handle", () => {
    expect(parseFediverseHandle("")).toBeNull();
    expect(parseFediverseHandle("http://mastodon.social/@name")).toBeNull();
    expect(parseFediverseHandle("https://mastodon.social/@name@other")).toBeNull();
    expect(parseFediverseHandle("name@1.2.3.4")).toBeNull();
    expect(
      parseFediverseHandle("https://mastodon.social/@name?share=1")
    ).toBeNull();
    expect(parseFediverseHandle("name@")).toBeNull();
  });
});
