"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useInviteRealtime } from "@/hooks/useFriendRealtime";
import type { RoomInvite } from "@/lib/types";

type InviteWithJoins = RoomInvite & {
  room?: { id: string; name: string; slug: string } | null;
  from_user?: { display_name: string | null } | null;
};

export function InviteToast() {
  const supabase = createClient();
  const router = useRouter();
  const [userId, setUserId] = useState<string>();
  const [invites, setInvites] = useState<InviteWithJoins[]>([]);
  const [busy, setBusy] = useState(false);

  const refreshInvites = useCallback(async () => {
    const res = await fetch("/api/invites");
    if (!res.ok) {
      if (res.status === 401) {
        setInvites([]);
      }
      return;
    }
    const data = (await res.json()) as InviteWithJoins[];
    setInvites(data ?? []);
  }, []);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setUserId(undefined);
        setInvites([]);
        return;
      }
      setUserId(user.id);
      await refreshInvites();
    };
    void init();
  }, [supabase, refreshInvites]);

  useInviteRealtime(userId, refreshInvites);

  const currentInvite = invites[0];
  if (!currentInvite) return null;

  const dismissInvite = async (inviteId: string) => {
    setBusy(true);
    try {
      await fetch(`/api/invites/${inviteId}/dismiss`, {
        method: "POST",
      });
      await refreshInvites();
    } finally {
      setBusy(false);
    }
  };

  const joinInvite = async () => {
    if (!currentInvite.room?.slug) return;
    setBusy(true);
    try {
      await dismissInvite(currentInvite.id);
      router.push(`/rooms/${currentInvite.room.slug}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[180] w-[min(92vw,520px)]">
      <div className="glass-panel rounded-2xl border border-[var(--ndl-line)] px-4 py-3 shadow-[0_16px_38px_rgba(0,0,0,0.55)]">
        <p className="text-sm font-semibold leading-snug">
          <span className="text-glow-soft">
            {currentInvite.from_user?.display_name || "A friend"}
          </span>{" "}
          invited you to{" "}
          <span className="text-foreground">
            {currentInvite.room?.name || "a room"}
          </span>
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void joinInvite()}
            disabled={busy || !currentInvite.room?.slug}
            className="btn-primary px-4 py-2 rounded-full text-xs font-extrabold disabled:opacity-50"
          >
            Join
          </button>
          <button
            type="button"
            onClick={() => void dismissInvite(currentInvite.id)}
            disabled={busy}
            className="btn-secondary px-4 py-2 rounded-full text-xs font-semibold disabled:opacity-50"
          >
            Dismiss
          </button>
          {invites.length > 1 && (
            <span className="ml-auto text-[11px] text-muted">
              +{invites.length - 1} more
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
