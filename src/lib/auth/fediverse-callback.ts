import { accountsMatch } from "./fediverse-broker";
import { safeRedirectPath } from "./safe-redirect";

export type FediState = {
  nonce: string;
  acct: string;
  host: string;
  next: string;
};

export function parseFediState(raw: string | undefined): FediState | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<FediState>;
    if (
      !data ||
      typeof data.nonce !== "string" ||
      typeof data.acct !== "string" ||
      typeof data.host !== "string" ||
      typeof data.next !== "string"
    ) {
      return null;
    }
    return {
      nonce: data.nonce,
      acct: data.acct,
      host: data.host,
      next: data.next,
    };
  } catch {
    return null;
  }
}

export function loginErrorLocation(
  origin: string,
  error: string,
  handle?: string | null
): string {
  const url = new URL("/auth/login", origin);
  url.searchParams.set("error", error);
  if (handle) url.searchParams.set("handle", handle);
  return url.toString();
}

export function fediverseCallbackPlan(input: {
  origin: string;
  code: string | null;
  state: string | null;
  providerError: string | null;
  cookie: FediState | null;
  account: { username?: string | null; url?: string | null } | null;
  exchangeFailed: boolean;
}): { location: string; mint: boolean } {
  const handle = input.cookie?.acct ?? null;
  if (input.providerError === "access_denied" || !input.code) {
    return {
      location: loginErrorLocation(input.origin, "fedi_canceled", handle),
      mint: false,
    };
  }
  if (!input.cookie || !input.state || input.state !== input.cookie.nonce) {
    return {
      location: loginErrorLocation(input.origin, "fedi_expired", handle),
      mint: false,
    };
  }
  if (input.exchangeFailed || !input.account) {
    return {
      location: loginErrorLocation(input.origin, "fedi_unsupported", handle),
      mint: false,
    };
  }
  const [username, host] = input.cookie.acct.split("@");
  if (
    !username ||
    !host ||
    !accountsMatch({ username, host }, input.account)
  ) {
    return {
      location: loginErrorLocation(input.origin, "fedi_mismatch", handle),
      mint: false,
    };
  }
  return {
    location: `${input.origin}${safeRedirectPath(input.cookie.next)}`,
    mint: true,
  };
}
