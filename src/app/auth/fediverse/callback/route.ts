import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { fediverseRedirectUri, resolveAppOrigin } from "@/lib/auth/app-origin";
import {
  exchangeAuthorizationCode,
  fediverseFailure,
  fediverseValue,
  fetchVerifiedAccount,
  fediverseRequest,
} from "@/lib/auth/fediverse-broker";
import {
  fediverseCallbackPlan,
  loginErrorLocation,
  parseFediState,
} from "@/lib/auth/fediverse-callback";
import { assertPublicHost } from "@/lib/auth/fediverse-host";
import { establishFediverseSession } from "@/lib/auth/fediverse-session";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const STATE_COOKIE = "needle_fedi_state";

function clearState(response: NextResponse) {
  response.cookies.set(STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth/fediverse",
    maxAge: 0,
  });
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = resolveAppOrigin(
    process.env.NEXT_PUBLIC_APP_URL,
    url.origin
  );
  const cookieStore = await cookies();
  const cookie = parseFediState(cookieStore.get(STATE_COOKIE)?.value);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const providerError = url.searchParams.get("error");

  const early = fediverseCallbackPlan({
    origin,
    code,
    state,
    providerError,
    cookie,
    account: null,
    exchangeFailed: false,
  });
  const stateOk = Boolean(cookie && code && state && state === cookie.nonce);
  if (providerError === "access_denied" || !code || !stateOk) {
    return clearState(NextResponse.redirect(early.location));
  }

  const admin = createServiceClient();
  const { data: appRow } = await admin
    .from("fediverse_oauth_apps")
    .select("client_id, client_secret")
    .eq("host", cookie!.host)
    .maybeSingle();

  const requestFn = (target: string, init: RequestInit) =>
    fediverseRequest(target, init, {
      fetch: globalThis.fetch,
      assertHost: assertPublicHost,
    });

  let account: { username: string; url: string; displayName: string; avatarUrl: string | null } | null = null;
  let exchangeFailed = true;
  let refused = false;

  if (appRow?.client_id && appRow.client_secret) {
    const token = await exchangeAuthorizationCode({
      host: cookie!.host,
      clientId: appRow.client_id,
      clientSecret: appRow.client_secret,
      code,
      redirectUri: fediverseRedirectUri(origin),
      request: requestFn,
    });
    const accessToken = fediverseValue(token);
    if (!accessToken) {
      refused = fediverseFailure(token) === "refused";
    } else {
      const verified = await fetchVerifiedAccount({
        host: cookie!.host,
        accessToken,
        request: requestFn,
      });
      const verifiedAccount = fediverseValue(verified);
      if (!verifiedAccount) {
        refused = fediverseFailure(verified) === "refused";
      } else {
        account = verifiedAccount;
        exchangeFailed = false;
      }
    }
  }

  if (refused) {
    return clearState(
      NextResponse.redirect(
        loginErrorLocation(origin, "fedi_refused", cookie!.acct)
      )
    );
  }

  const plan = fediverseCallbackPlan({
    origin,
    code,
    state,
    providerError,
    cookie,
    account,
    exchangeFailed,
  });

  if (plan.mint && account && cookie) {
    await establishFediverseSession(
      {
        acct: cookie.acct,
        displayName: account.displayName,
        avatarUrl: account.avatarUrl,
      },
      {
        findUserIdByAcct: async (acct) => {
          const { data } = await admin
            .from("users")
            .select("id")
            .eq("fediverse_acct", acct)
            .maybeSingle();
          return data?.id ?? null;
        },
        createAuthUser: async ({ email, metadata }) => {
          const { error } = await admin.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: metadata,
          });
          if (!error) return { ok: true };
          return {
            ok: false,
            duplicate: /already|duplicate|exists|registered/i.test(error.message),
          };
        },
        mintSession: async (email) => {
          const link = await admin.auth.admin.generateLink({
            type: "magiclink",
            email,
          });
          const tokenHash = link.data?.properties?.hashed_token;
          if (link.error || !tokenHash) {
            throw new Error(link.error?.message ?? "Could not start session");
          }
          const supabase = await createClient();
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "magiclink",
          });
          if (error) throw new Error(error.message);
        },
      }
    );
  }

  return clearState(NextResponse.redirect(plan.location));
}
