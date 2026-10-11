"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { shouldRefreshServerSession } from "@/lib/auth/server-session-sync";
import { createClient } from "@/lib/supabase/client";

/**
 * Keeps the server-rendered account menu in sync with the browser session.
 * Sign-out still refreshes so a rejected refresh token cannot leave a
 * half-authenticated page. Sign-in refreshes once when the browser already
 * holds a session the server did not render, which is what happens on the
 * first page after Google sends the browser back.
 */
export function AuthWatcher() {
  const router = useRouter();
  const synced = useRef(false);

  useEffect(() => {
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const serverHasSession =
        document.documentElement.dataset.session === "1";
      if (event === "SIGNED_OUT") {
        router.refresh();
        return;
      }
      if (synced.current) return;
      if (
        shouldRefreshServerSession({
          event,
          hasSession: Boolean(session),
          serverHasSession,
        })
      ) {
        synced.current = true;
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
