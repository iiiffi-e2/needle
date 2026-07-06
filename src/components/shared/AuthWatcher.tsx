"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Global listener that keeps the server-rendered view in sync with the
 * browser's auth state. Its main job is self-healing: when a stored session
 * becomes invalid (e.g. a stale/rotated refresh token left over after an Auth
 * outage), the Supabase client emits SIGNED_OUT and clears its cookies. We
 * react by re-running server components so protected pages redirect to login,
 * instead of leaving the UI stuck in a broken, half-authenticated loop.
 */
export function AuthWatcher() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // Only react to sign-out. This covers both explicit logout and, more
      // importantly, the involuntary case where the stored refresh token is
      // rejected. Re-running server components lets protected pages redirect
      // to login cleanly. (Other events like INITIAL_SESSION / TOKEN_REFRESHED
      // must be ignored to avoid needless refreshes on load and tab focus.)
      if (event === "SIGNED_OUT") {
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
