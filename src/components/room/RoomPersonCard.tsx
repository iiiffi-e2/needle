"use client";

import { useEffect, useRef, useState } from "react";
import { FriendActions } from "@/components/profile/FriendActions";
import { UserAvatar } from "@/components/shared/UserAvatar";
import {
  personDisplayName,
  profileLink,
  relationshipApplies,
  showsFriendActions,
  type RoomPerson,
} from "@/lib/room-person";
import type { Relationship } from "@/lib/types";

interface RoomPersonCardProps {
  person: RoomPerson;
  currentUserId: string | null;
  onClose: () => void;
}

export function RoomPersonCard({
  person,
  currentUserId,
  onClose,
}: RoomPersonCardProps) {
  const canFriend =
    currentUserId !== null &&
    showsFriendActions(currentUserId, person.userId);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">(
    canFriend ? "loading" : "ready"
  );
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [error, setError] = useState("");
  const openUserIdRef = useRef(person.userId);
  openUserIdRef.current = person.userId;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!canFriend || !currentUserId) return;
    const requestedId = person.userId;
    let cancelled = false;
    setPhase("loading");
    setError("");

    fetch(`/api/friends/${requestedId}`)
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload.error || "Request failed");
        }
        return payload as { relationship: Relationship | null };
      })
      .then((payload) => {
        if (cancelled) return;
        if (!relationshipApplies(requestedId, openUserIdRef.current)) return;
        setRelationship(payload.relationship);
        setPhase("ready");
      })
      .catch((caught) => {
        if (cancelled) return;
        if (!relationshipApplies(requestedId, openUserIdRef.current)) return;
        const message =
          caught instanceof Error ? caught.message : "Something went wrong";
        setError(message);
        setPhase("error");
      });

    return () => {
      cancelled = true;
    };
  }, [attempt, canFriend, currentUserId, person.userId]);

  const name = personDisplayName(person.displayName);
  const link = profileLink(person.userId);

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[120] border-none cursor-pointer"
        style={{ background: "rgba(0, 0, 0, 0.55)" }}
        aria-label="Close profile"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[121] flex items-center justify-center p-4 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="room-person-name"
          className="glass-panel pointer-events-auto w-full max-w-[320px] rounded-2xl p-5 shadow-[0_18px_50px_rgba(0,0,0,0.75)]"
        >
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="text-[12px] font-bold cursor-pointer bg-transparent border-none"
              style={{ color: "var(--sub)" }}
            >
              Close
            </button>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <UserAvatar
              name={name}
              avatarUrl={person.avatarUrl}
              userId={person.userId}
              avatarColor={person.avatarColor}
              size="lg"
            />
            <h2
              id="room-person-name"
              className="font-display text-[17px] font-extrabold"
            >
              {name}
            </h2>
          </div>

          {canFriend && currentUserId && (
            <div className="mt-4">
              {phase === "loading" && (
                <p className="text-sm text-muted">Loading...</p>
              )}
              {phase === "error" && (
                <div>
                  <p className="text-sm text-danger">{error}</p>
                  <button
                    type="button"
                    onClick={() => setAttempt((n) => n + 1)}
                    className="btn-secondary mt-3 px-4 py-2 rounded-full text-sm font-medium"
                  >
                    Retry
                  </button>
                </div>
              )}
              {phase === "ready" && (
                <FriendActions
                  layout="plain"
                  profileUserId={person.userId}
                  currentUserId={currentUserId}
                  initialRelationship={relationship}
                />
              )}
            </div>
          )}

          <a
            href={link.href}
            target={link.target}
            rel={link.rel}
            className="inline-block mt-4 text-sm font-semibold text-glow-soft hover:underline"
          >
            View full profile
          </a>
        </div>
      </div>
    </>
  );
}
