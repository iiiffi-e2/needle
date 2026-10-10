import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callbackErrorCode } from "@/lib/auth/auth-errors";
import { loginErrorLocation } from "@/lib/auth/fediverse-callback";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      const value = decodeURIComponent(rest.join("="));
      return value || null;
    }
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const provider = readCookie(
    request.headers.get("cookie"),
    "needle_auth_provider"
  );

  let exchangeOk = false;
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    exchangeOk = !error;
  }

  const location =
    code && exchangeOk
      ? `${origin}${safeRedirectPath(next)}`
      : loginErrorLocation(
          origin,
          callbackErrorCode({ provider, hasCode: Boolean(code) })
        );

  const response = NextResponse.redirect(location);
  response.cookies.set("needle_auth_provider", "", { path: "/", maxAge: 0 });
  return response;
}
