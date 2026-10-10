import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { resolveAppOrigin, fediverseRedirectUri } from "@/lib/auth/app-origin";
import { authorizeUrl, fediverseFailure, fediverseRequest, fediverseValue, loadOrRegisterApp } from "@/lib/auth/fediverse-broker";
import { parseFediverseHandle } from "@/lib/auth/fediverse-handle";
import { assertPublicHost } from "@/lib/auth/fediverse-host";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { createServiceClient } from "@/lib/supabase/admin";

const STATE_COOKIE = "needle_fedi_state";

export async function POST(request: Request) {
  let body: { handle?: unknown; next?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "handle" }, { status: 400 });
  }

  const parsed = parseFediverseHandle(
    typeof body.handle === "string" ? body.handle : ""
  );
  if (!parsed) {
    return NextResponse.json({ error: "handle" }, { status: 400 });
  }

  if (!(await assertPublicHost(parsed.host))) {
    return NextResponse.json({ error: "fedi_refused" }, { status: 400 });
  }

  const origin = resolveAppOrigin(
    process.env.NEXT_PUBLIC_APP_URL,
    new URL(request.url).origin
  );
  const admin = createServiceClient();
  const registered = await loadOrRegisterApp({
    host: parsed.host,
    origin,
    load: async (host) => {
      const { data } = await admin
        .from("fediverse_oauth_apps")
        .select("client_id, client_secret")
        .eq("host", host)
        .maybeSingle();
      if (!data?.client_id || !data.client_secret) return null;
      return {
        host,
        clientId: data.client_id,
        clientSecret: data.client_secret,
      };
    },
    save: async (app) => {
      const { error } = await admin.from("fediverse_oauth_apps").insert({
        host: app.host,
        client_id: app.clientId,
        client_secret: app.clientSecret,
      });
      if (error && !/duplicate|unique/i.test(error.message)) {
        throw new Error(error.message);
      }
    },
    request: (url, init) =>
      fediverseRequest(url, init, {
        fetch: globalThis.fetch,
        assertHost: assertPublicHost,
      }),
  });

  const app = fediverseValue(registered);
  if (!app) {
    const error = fediverseFailure(registered) === "refused" ? "fedi_refused" : "fedi_unsupported";
    return NextResponse.json({ error }, { status: 400 });
  }

  const nonce = randomBytes(16).toString("hex");
  const response = NextResponse.json({
    url: authorizeUrl({
      host: parsed.host,
      clientId: app.clientId,
      redirectUri: fediverseRedirectUri(origin),
      state: nonce,
    }),
  });
  response.cookies.set(
    STATE_COOKIE,
    JSON.stringify({
      nonce,
      acct: parsed.acct,
      host: parsed.host,
      next: safeRedirectPath(typeof body.next === "string" ? body.next : null),
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/auth/fediverse",
      maxAge: 600,
    }
  );
  return response;
}
