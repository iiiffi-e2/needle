import { describe, expect, it, vi } from "vitest";
import {
  establishFediverseSession,
  fediverseEmail,
  publicEmailForAuthUser,
} from "./fediverse-session";

describe("fediverseEmail", () => {
  it("is stable and not deliverable", () => {
    const email = fediverseEmail("ada@mastodon.social");
    expect(email).toBe(fediverseEmail("ada@mastodon.social"));
    expect(email.endsWith("@users.needle.invalid")).toBe(true);
    expect(email.startsWith("fedi.")).toBe(true);
  });
});

describe("publicEmailForAuthUser", () => {
  it("hides the synthetic address", () => {
    expect(publicEmailForAuthUser(fediverseEmail("ada@mastodon.social"))).toBeNull();
    expect(publicEmailForAuthUser("ada@example.com")).toBe("ada@example.com");
    expect(publicEmailForAuthUser(null)).toBeNull();
  });
});

describe("establishFediverseSession", () => {
  const profile = {
    acct: "ada@mastodon.social",
    displayName: "Ada",
    avatarUrl: "https://mastodon.social/a.png",
  };

  it("mints the existing account without creating another", async () => {
    const createAuthUser = vi.fn();
    const mintSession = vi.fn(async () => undefined);
    const result = await establishFediverseSession(profile, {
      findUserIdByAcct: async () => "user-1",
      createAuthUser,
      mintSession,
    });
    expect(result).toEqual({ created: false });
    expect(createAuthUser).not.toHaveBeenCalled();
    expect(mintSession).toHaveBeenCalledWith(fediverseEmail(profile.acct));
  });

  it("creates once and does not pass a credential email", async () => {
    const createAuthUser = vi.fn(async () => ({ ok: true as const }));
    const mintSession = vi.fn(async () => undefined);
    const result = await establishFediverseSession(profile, {
      findUserIdByAcct: async () => null,
      createAuthUser,
      mintSession,
    });
    expect(result).toEqual({ created: true });
    expect(createAuthUser).toHaveBeenCalledWith({
      email: fediverseEmail(profile.acct),
      metadata: {
        display_name: "Ada",
        fediverse_acct: "ada@mastodon.social",
        avatar_url: "https://mastodon.social/a.png",
      },
    });
    expect(mintSession).toHaveBeenCalledOnce();
  });

  it("mints after a duplicate create once the account can be found", async () => {
    const createAuthUser = vi.fn(async () => ({
      ok: false as const,
      duplicate: true,
    }));
    const mintSession = vi.fn(async () => undefined);
    let lookups = 0;
    const result = await establishFediverseSession(profile, {
      findUserIdByAcct: async () => {
        lookups += 1;
        return lookups === 1 ? null : "user-1";
      },
      createAuthUser,
      mintSession,
    });
    expect(result).toEqual({ created: false });
    expect(mintSession).toHaveBeenCalledOnce();
  });
});
