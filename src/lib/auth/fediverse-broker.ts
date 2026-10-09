export const FEDIVERSE_TIMEOUT_MS = 8000;
export const FEDIVERSE_SCOPE = "read:accounts";

export type FediverseResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "refused" | "unsupported" };

export function fediverseFailure<T>(
  result: FediverseResult<T>
): "refused" | "unsupported" | null {
  return "reason" in result ? result.reason : null;
}

export function fediverseValue<T>(result: FediverseResult<T>): T | null {
  return "value" in result ? result.value : null;
}

export type FediverseFetch = (
  url: string,
  init: RequestInit
) => Promise<Response>;

export type HostGuard = (host: string) => Promise<boolean>;

export function accountsMatch(
  requested: { username: string; host: string },
  account: { username?: string | null; url?: string | null }
): boolean {
  if (!account.username || !account.url) return false;
  if (account.username.trim().toLowerCase() !== requested.username) return false;
  try {
    const url = new URL(account.url);
    return url.protocol === "https:" && url.hostname.toLowerCase() === requested.host;
  } catch {
    return false;
  }
}

export function fediverseDisplayName(
  displayName: string | null | undefined,
  username: string
): string {
  const trimmed = displayName?.trim();
  return trimmed ? trimmed : username;
}

export function httpsAvatar(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

export function authorizeUrl(input: {
  host: string;
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(`https://${input.host}/oauth/authorize`);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", FEDIVERSE_SCOPE);
  url.searchParams.set("state", input.state);
  return url.toString();
}

export async function fediverseRequest(
  url: string,
  init: RequestInit,
  deps: {
    fetch: FediverseFetch;
    assertHost: HostGuard;
    timeoutMs?: number;
  }
): Promise<FediverseResult<Response>> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: "unsupported" };
  }
  if (parsed.protocol !== "https:" || parsed.port) {
    return { ok: false, reason: "unsupported" };
  }
  const allowed = await deps.assertHost(parsed.hostname);
  if (!allowed) return { ok: false, reason: "refused" };

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    deps.timeoutMs ?? FEDIVERSE_TIMEOUT_MS
  );
  try {
    const response = await deps.fetch(url, {
      ...init,
      redirect: "manual",
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) {
      return { ok: false, reason: "unsupported" };
    }
    if (!response.ok) return { ok: false, reason: "unsupported" };
    return { ok: true, value: response };
  } catch {
    return { ok: false, reason: "unsupported" };
  } finally {
    clearTimeout(timer);
  }
}

export type FediverseApp = {
  host: string;
  clientId: string;
  clientSecret: string;
};

export async function loadOrRegisterApp(input: {
  host: string;
  origin: string;
  load: (host: string) => Promise<FediverseApp | null>;
  save: (app: FediverseApp) => Promise<void>;
  request: (
    url: string,
    init: RequestInit
  ) => Promise<FediverseResult<Response>>;
}): Promise<FediverseResult<FediverseApp>> {
  const existing = await input.load(input.host);
  if (existing) return { ok: true, value: existing };

  const redirectUri = `${input.origin}/auth/fediverse/callback`;
  const result = await input.request(`https://${input.host}/api/v1/apps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Needle",
      redirect_uris: redirectUri,
      scopes: FEDIVERSE_SCOPE,
      website: input.origin,
    }),
  });
  const registrationFailure = fediverseFailure(result);
  if (registrationFailure) return { ok: false, reason: registrationFailure };
  const registrationResponse = fediverseValue(result);
  if (!registrationResponse) return { ok: false, reason: "unsupported" };

  const body = (await registrationResponse.json()) as {
    client_id?: string;
    client_secret?: string;
  };
  if (!body.client_id || !body.client_secret) {
    return { ok: false, reason: "unsupported" };
  }
  const app = {
    host: input.host,
    clientId: body.client_id,
    clientSecret: body.client_secret,
  };
  await input.save(app);
  return { ok: true, value: app };
}

export async function exchangeAuthorizationCode(input: {
  host: string;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  request: (
    url: string,
    init: RequestInit
  ) => Promise<FediverseResult<Response>>;
}): Promise<FediverseResult<string>> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
  });
  const result = await input.request(`https://${input.host}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenFailure = fediverseFailure(result);
  if (tokenFailure) return { ok: false, reason: tokenFailure };
  const tokenResponse = fediverseValue(result);
  if (!tokenResponse) return { ok: false, reason: "unsupported" };
  const payload = (await tokenResponse.json()) as { access_token?: string };
  if (!payload.access_token) return { ok: false, reason: "unsupported" };
  return { ok: true, value: payload.access_token };
}

export type VerifiedFediverseAccount = {
  username: string;
  url: string;
  displayName: string;
  avatarUrl: string | null;
};

export async function fetchVerifiedAccount(input: {
  host: string;
  accessToken: string;
  request: (
    url: string,
    init: RequestInit
  ) => Promise<FediverseResult<Response>>;
}): Promise<FediverseResult<VerifiedFediverseAccount>> {
  const result = await input.request(
    `https://${input.host}/api/v1/accounts/verify_credentials`,
    { headers: { Authorization: `Bearer ${input.accessToken}` } }
  );
  const accountFailure = fediverseFailure(result);
  if (accountFailure) return { ok: false, reason: accountFailure };
  const accountResponse = fediverseValue(result);
  if (!accountResponse) return { ok: false, reason: "unsupported" };
  const body = (await accountResponse.json()) as {
    username?: string;
    url?: string;
    display_name?: string;
    avatar?: string;
    email?: string;
  };
  if (!body.username || !body.url) {
    return { ok: false, reason: "unsupported" };
  }
  return {
    ok: true,
    value: {
      username: body.username,
      url: body.url,
      displayName: fediverseDisplayName(body.display_name, body.username),
      avatarUrl: httpsAvatar(body.avatar),
    },
  };
}
