"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function useFriendRealtime(
  userId: string | undefined,
  onChange: () => void
) {
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`friends:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "relationships",
          filter: `user_a_id=eq.${userId}`,
        },
        () => onChange()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "relationships",
          filter: `user_b_id=eq.${userId}`,
        },
        () => onChange()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, onChange]);
}

export function useInviteRealtime(
  userId: string | undefined,
  onChange: () => void
) {
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    const channel = supabase
      .channel(`invites:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_invites",
          filter: `to_user_id=eq.${userId}`,
        },
        () => onChange()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, onChange]);
}
