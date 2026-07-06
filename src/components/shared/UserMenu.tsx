"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useFriendRealtime } from "@/hooks/useFriendRealtime";
import { getInitials } from "@/lib/utils";
import { resolveUserColor } from "@/lib/design-tokens";
import type { Relationship, User } from "@/lib/types";

type PendingRequest = Relationship & { user: User };
type FriendRequestsResponse = {
  incoming: PendingRequest[];
};

interface UserMenuProps {
  userId: string;
  displayName: string;
  variant?: "pill" | "avatar";
  avatarColor?: string | null;
  roomSlug?: string;
}

export function UserMenu({
  userId,
  displayName,
  variant = "pill",
  avatarColor,
  roomSlug,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [incoming, setIncoming] = useState<PendingRequest[]>([]);
  const [requestActionId, setRequestActionId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const refreshRequests = useCallback(async () => {
    const res = await fetch("/api/friends/requests");
    if (!res.ok) return;
    const data = (await res.json()) as FriendRequestsResponse;
    setIncoming(data.incoming ?? []);
  }, []);

  useEffect(() => {
    void refreshRequests();
  }, [refreshRequests]);

  useFriendRealtime(userId, refreshRequests);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const handleSignOut = async () => {
    setSigningOut(true);
    if (roomSlug) {
      await fetch(`/api/rooms/${roomSlug}/presence`, {
        method: "DELETE",
      }).catch(() => {});
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/");
    router.refresh();
  };

  const color = resolveUserColor(userId, avatarColor);

  const runRequestAction = async (
    actionId: string,
    endpoint: string
  ): Promise<void> => {
    setRequestActionId(actionId);
    try {
      await fetch(endpoint, { method: "POST" });
      await refreshRequests();
    } finally {
      setRequestActionId(null);
    }
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${displayName}`}
        className={`relative ${
          variant === "avatar"
            ? "w-[34px] h-[34px] rounded-full shrink-0 flex items-center justify-center font-extrabold text-[13px] text-[#1c1414] cursor-pointer"
            : "text-sm font-bold px-3 py-1 rounded-full border border-[var(--ndl-line)] hover:border-glow/40 transition-colors cursor-pointer"
        }`}
        style={
          variant === "avatar"
            ? {
                background: `radial-gradient(circle at 38% 26%, #ffffff8c, #ffffff00 46%), ${color}`,
                boxShadow: `0 0 0 2px var(--bg1), 0 0 14px ${color}88`,
              }
            : undefined
        }
      >
        {variant === "avatar" ? getInitials(displayName) : displayName}
        {incoming.length > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-[18px] text-center shadow-[0_0_12px_rgba(239,68,68,0.65)]"
            aria-label={`${incoming.length} pending friend requests`}
          >
            {incoming.length > 9 ? "9+" : incoming.length}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 min-w-[160px] py-1.5 rounded-xl border border-[var(--ndl-line)] bg-[var(--ndl-bg1)] shadow-[0_8px_24px_rgba(0,0,0,0.35)] z-[200]"
        >
          {incoming.length > 0 && (
            <>
              <div className="px-4 py-2 border-b border-[var(--ndl-line)]">
                <p className="text-[11px] uppercase tracking-wider text-muted font-semibold">
                  Incoming Requests
                </p>
                <div className="mt-2 space-y-2">
                  {incoming.slice(0, 3).map((request) => (
                    <div key={request.id} className="rounded-lg bg-white/5 px-2 py-2">
                      <p className="text-xs font-semibold truncate text-foreground">
                        {request.user.display_name || "Anonymous"}
                      </p>
                      <div className="mt-1.5 flex gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            void runRequestAction(
                              `accept-${request.id}`,
                              `/api/friends/requests/${request.id}/accept`
                            )
                          }
                          disabled={requestActionId !== null}
                          className="rounded-full bg-green-500/25 border border-green-400/40 px-2 py-1 text-[11px] font-bold text-green-100 disabled:opacity-50"
                        >
                          {requestActionId === `accept-${request.id}` ? "..." : "Accept"}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void runRequestAction(
                              `decline-${request.id}`,
                              `/api/friends/requests/${request.id}/decline`
                            )
                          }
                          disabled={requestActionId !== null}
                          className="rounded-full bg-white/10 border border-[var(--ndl-line)] px-2 py-1 text-[11px] font-medium text-muted hover:text-foreground disabled:opacity-50"
                        >
                          {requestActionId === `decline-${request.id}` ? "..." : "Decline"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <Link
                  href="/friends"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="mt-2 inline-flex text-xs text-glow-soft hover:text-glow transition-colors"
                >
                  See all
                </Link>
              </div>
            </>
          )}
          <Link
            href="/friends"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-muted hover:text-foreground hover:bg-white/5 transition-colors"
          >
            Friends
          </Link>
          <Link
            href={`/profile/${userId}`}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-muted hover:text-foreground hover:bg-white/5 transition-colors"
          >
            View profile
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full text-left px-4 py-2 text-sm text-muted hover:text-foreground hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            {signingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
