import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname.includes(".");
  const isAuthFlow =
    pathname.startsWith("/auth/") && pathname !== "/auth/onboarding";
  const isApi = pathname.startsWith("/api/");

  if (
    user &&
    !isPublicAsset &&
    !isAuthFlow &&
    !isApi &&
    pathname !== "/auth/onboarding"
  ) {
    const { data: profile } = await supabase
      .from("users")
      .select("avatar_color")
      .eq("id", user.id)
      .single();

    if (!profile?.avatar_color) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/onboarding";
      if (pathname !== "/") {
        url.searchParams.set("redirect", pathname + request.nextUrl.search);
      }
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
