import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Hard cap on any Supabase call in middleware. Even though auth is now
// verified locally (see getClaims below), the first JWKS fetch / token
// refresh / profile query can still touch the network. Never let that hang
// past Vercel's middleware limit (which would 504 every route).
const SUPABASE_TIMEOUT_MS = 2500;

// Cookie used to remember that a user has finished onboarding, so we don't
// hit the DB on every request. Onboarding sets avatar_color exactly once, so
// this flag is safe to cache for a long time. The value is the user id so a
// stale cookie can never leak across accounts on a shared browser.
const ONBOARDED_COOKIE = "needle_onboarded";
const ONBOARDED_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function onboardedCookieOptions() {
  return {
    maxAge: ONBOARDED_MAX_AGE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const pathname = request.nextUrl.pathname;
  const isPublicAsset =
    pathname.startsWith("/_next") || pathname.includes(".");
  const isAuthFlow =
    pathname.startsWith("/auth/") && pathname !== "/auth/onboarding";
  const isApi = pathname.startsWith("/api/");

  // Verify the session locally. With asymmetric JWT signing keys enabled,
  // getClaims() validates the token with a cached public key (no round-trip
  // to the Auth server), and getSession() underneath still refreshes the
  // cookie when the token is near expiry. Fail open on any error/timeout.
  const claims = await withTimeout(
    supabase.auth
      .getClaims()
      .then(({ data }) => data?.claims ?? null)
      .catch(() => null),
    SUPABASE_TIMEOUT_MS,
    null
  );

  const userId = typeof claims?.sub === "string" ? claims.sub : null;

  const protectedRoutes = ["/friends", "/rooms/create"];
  if (
    !userId &&
    !isApi &&
    !isAuthFlow &&
    protectedRoutes.includes(pathname)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (userId && !isPublicAsset && !isApi) {
    // Cookie is trusted only when it belongs to the current user id.
    let hasAvatarColor =
      request.cookies.get(ONBOARDED_COOKIE)?.value === userId;

    // Only touch the DB if we haven't already cached that this user is
    // onboarded. Bounded + fail-open so a slow DB can't wedge middleware.
    if (!hasAvatarColor) {
      const profile = await withTimeout(
        Promise.resolve(
          supabase
            .from("users")
            .select("avatar_color")
            .eq("id", userId)
            .maybeSingle()
        )
          .then(({ data }) => data)
          .catch(() => null),
        SUPABASE_TIMEOUT_MS,
        null
      );

      hasAvatarColor = Boolean(profile?.avatar_color);

      if (hasAvatarColor) {
        supabaseResponse.cookies.set(
          ONBOARDED_COOKIE,
          userId,
          onboardedCookieOptions()
        );
      }
    }

    if (pathname === "/auth/onboarding") {
      if (hasAvatarColor) {
        const url = request.nextUrl.clone();
        url.pathname = "/rooms";
        url.search = "";
        const redirect = NextResponse.redirect(url);
        redirect.cookies.set(ONBOARDED_COOKIE, userId, onboardedCookieOptions());
        return redirect;
      }
      return supabaseResponse;
    }

    if (!isAuthFlow && !hasAvatarColor) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/onboarding";
      if (pathname !== "/") {
        url.searchParams.set("redirect", pathname + request.nextUrl.search);
      } else {
        url.searchParams.set("redirect", "/rooms");
      }
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
