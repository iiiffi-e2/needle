"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UserAvatar } from "@/components/shared/UserAvatar";
import type { FriendWithPresence } from "@/lib/types";

interface InviteFriendsButtonProps {
  roomSlug: string;
  currentUserId: string;
  memberUserIds?: Set<string>;
}

export function InviteFriendsButton({
  roomSlug,
  currentUserId,
  memberUserIds,
}: InviteFriendsButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState<FriendWithPresence[]>([]);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const loadFriends = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/friends");
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to load friends");
      }
      const data = (await res.json()) as FriendWithPresence[];
      setFriends(data ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to load friends");
      setFriends([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void loadFriends();
  }, [open, loadFriends]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(timer);
  }, [toast]);

  const invitableFriends = useMemo(() => {
    return friends.filter((friend) => {
      const id = friend.user.id;
      if (id === currentUserId) return false;
      if (memberUserIds?.has(id)) return false;
      return true;
    });
  }, [friends, currentUserId, memberUserIds]);

  const sendInvite = async (friendUserId: string) => {
    setSendingTo(friendUserId);
    setError("");
    try {
      const res = await fetch(`/api/rooms/${roomSlug}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: friendUserId }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error || "Could not send invite");
      }
      setSentIds((prev) => {
        const next = new Set(prev);
        next.add(friendUserId);
        return next;
      });
      setToast("Invite sent");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send invite");
    } finally {
      setSendingTo(null);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-[var(--ndl-line)] px-3 py-1.5 text-xs font-bold text-muted hover:text-foreground hover:border-glow/40 transition-colors"
      >
        Invite Friends
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 bg-black/55 z-[150]"
            aria-label="Close invite picker"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-0 z-[151] flex items-center justify-center p-4">
            <div className="glass-panel w-full max-w-md rounded-2xl border border-[var(--ndl-line)] p-4 shadow-[0_18px_42px_rgba(0,0,0,0.6)]">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-extrabold text-lg">Invite friends</h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-sm text-muted hover:text-foreground"
                >
                  Close
                </button>
              </div>

              {error && <p className="mb-2 text-sm text-danger">{error}</p>}

              {loading ? (
                <p className="text-sm text-muted italic">Loading friends...</p>
              ) : invitableFriends.length === 0 ? (
                <p className="text-sm text-muted italic">
                  No friends available to invite right now.
                </p>
              ) : (
                <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                  {invitableFriends.map((friend) => (
                    <div
                      key={friend.user.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--ndl-line)] bg-surface-light px-3 py-2.5"
                    >
                      <div className="min-w-0 flex items-center gap-3">
                        <UserAvatar
                          name={friend.user.display_name}
                          avatarUrl={friend.user.avatar_url}
                          userId={friend.user.id}
                          avatarColor={friend.user.avatar_color}
                          size="sm"
                        />
                        <p className="truncate text-sm font-medium">
                          {friend.user.display_name || "Anonymous"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void sendInvite(friend.user.id)}
                        disabled={sendingTo !== null || sentIds.has(friend.user.id)}
                        className="btn-primary rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-50"
                      >
                        {sendingTo === friend.user.id
                          ? "Sending..."
                          : sentIds.has(friend.user.id)
                            ? "Invited"
                            : "Invite"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[170] rounded-full px-4 py-2 text-xs font-extrabold text-[#1a0d06] bg-[linear-gradient(120deg,var(--glow),var(--accent))] shadow-[0_10px_28px_rgba(255,157,60,0.5)]">
          {toast}
        </div>
      )}
    </>
  );
}
