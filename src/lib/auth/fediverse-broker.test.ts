import { describe, expect, it, vi } from "vitest";
import {
  accountsMatch,
  exchangeAuthorizationCode,
  fetchVerifiedAccount,
  loadOrRegisterApp,
} from "./fediverse-broker";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("accountsMatch", () => {
  it("requires the username and the profile URL host", () => {
    expect(
      accountsMatch(
        { username: "ada", host: "mastodon.social" },
        { username: "Ada", url: "https://mastodon.social/@ada" }
      )
    ).toBe(true);
  });

  it("does not treat a local acct as host proof", () => {
    expect(
      accountsMatch(
        { username: "ada", host: "mastodon.social" },
        { username: "ada", url: "https://other.example/@ada" }
      )
    ).toBe(false);
  });
});

describe("loadOrRegisterApp", () => {
  it("reuses a stored app without calling the network", async () => {
    const request = vi.fn();
    const stored = {
      host: "mastodon.social",
      clientId: "id",
      clientSecret: "secret",
    };
    const result = await loadOrRegisterApp({
      host: "mastodon.social",
      origin: "https://needle.example",
      load: async () => stored,
      save: async () => undefined,
      request,
    });
    expect(result).toEqual({ ok: true, value: stored });
    expect(request).not.toHaveBeenCalled();
  });

  it("registers Needle once and stores the app", async () => {
    const save = vi.fn(async () => undefined);
    const request = vi.fn(async () => ({
      ok: true as const,
      value: jsonResponse({ client_id: "id", client_secret: "secret" }),
    }));
    const result = await loadOrRegisterApp({
      host: "mastodon.social",
      origin: "https://needle.example",
      load: async () => null,
      save,
      request,
    });
    expect(result.ok).toBe(true);
    expect(save).toHaveBeenCalledWith({
      host: "mastodon.social",
      clientId: "id",
      clientSecret: "secret",
    });
    expect(request).toHaveBeenCalledWith(
      "https://mastodon.social/api/v1/apps",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          client_name: "Needle",
          redirect_uris: "https://needle.example/auth/fediverse/callback",
          scopes: "read:accounts",
          website: "https://needle.example",
        }),
      })
    );
  });
});

describe("exchangeAuthorizationCode", () => {
  it("returns the access token", async () => {
    const request = vi.fn(async () => ({
      ok: true as const,
      value: jsonResponse({ access_token: "token" }),
    }));
    const result = await exchangeAuthorizationCode({
      host: "mastodon.social",
      clientId: "id",
      clientSecret: "secret",
      code: "code",
      redirectUri: "https://needle.example/auth/fediverse/callback",
      request,
    });
    expect(result).toEqual({ ok: true, value: "token" });
  });
});

describe("fetchVerifiedAccount", () => {
  it("drops the credential email and keeps the display name", async () => {
    const request = vi.fn(async () => ({
      ok: true as const,
      value: jsonResponse({
        username: "ada",
        url: "https://mastodon.social/@ada",
        display_name: "Ada",
        avatar: "https://mastodon.social/avatar.png",
        email: "someone@gmail.com",
      }),
    }));
    const result = await fetchVerifiedAccount({
      host: "mastodon.social",
      accessToken: "token",
      request,
    });
    expect(result).toEqual({
      ok: true,
      value: {
        username: "ada",
        url: "https://mastodon.social/@ada",
        displayName: "Ada",
        avatarUrl: "https://mastodon.social/avatar.png",
      },
    });
  });

  it("falls back to the username when the display name is blank", async () => {
    const request = vi.fn(async () => ({
      ok: true as const,
      value: jsonResponse({
        username: "ada",
        url: "https://mastodon.social/@ada",
        display_name: "  ",
        avatar: "http://insecure.example/a.png",
      }),
    }));
    const result = await fetchVerifiedAccount({
      host: "mastodon.social",
      accessToken: "token",
      request,
    });
    expect(result.ok && result.value.displayName).toBe("ada");
    expect(result.ok && result.value.avatarUrl).toBeNull();
  });
});
