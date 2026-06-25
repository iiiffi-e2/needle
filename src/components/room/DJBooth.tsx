"use client";

import { useState } from "react";
import { UserAvatar } from "@/components/shared/UserAvatar";
import type { DjSlot, DjWaitlistEntry, User } from "@/lib/types";
import { cn } from "@/lib/utils";

interface DJSlotProps {
  slot: DjSlot | null;
  isCurrentTurn: boolean;
  isCurrentUser: boolean;
  isSleeping?: boolean;
}

export function DJSlotComponent({
  slot,
  isCurrentTurn,
  isCurrentUser,
  isSleeping = false,
}: Omit<DJSlotProps, "position">) {
  if (!slot?.user) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-dashed border-white/10 min-h-[100px]",
          "text-muted text-sm"
        )}
      >
        <span className="text-2xl mb-1 opacity-30">🎤</span>
        Open
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center p-4 rounded-2xl transition-all duration-300",
        isCurrentTurn
          ? "bg-accent/10 border border-accent/30 animate-glow"
          : "bg-surface-light border border-white/5",
        isCurrentUser && "ring-2 ring-accent-secondary/50"
      )}
    >
      <UserAvatar
        name={slot.user.display_name}
        avatarUrl={slot.user.avatar_url}
        userId={slot.user_id}
        avatarColor={slot.user.avatar_color}
        size="lg"
        isActive={isCurrentTurn}
      />
      <p className="text-sm font-medium mt-2 truncate max-w-full">
        {slot.user.display_name}
      </p>
      {isCurrentTurn && (
        <span className="text-xs text-accent mt-1 font-medium">
          {isSleeping ? "zzzzz" : "On deck"}
        </span>
      )}
    </div>
  );
}

interface DJBoothProps {
  djSlots: DjSlot[];
  waitlist: DjWaitlistEntry[];
  currentDjUserId: string | null;
  currentUserId: string | null;
  maxDjs: number;
  roomSlug: string;
  isUserDj: boolean;
  isUserWaitlisted: boolean;
}

export function DJBooth({
  djSlots,
  waitlist,
  currentDjUserId,
  currentUserId,
  maxDjs,
  roomSlug,
  isUserDj,
  isUserWaitlisted,
}: DJBoothProps) {
  const [loading, setLoading] = useState(false);

  const handleJoinBooth = async () => {
    setLoading(true);
    try {
      await fetch(`/api/rooms/${roomSlug}/dj`, { method: "POST" });
      window.location.reload();
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveBooth = async () => {
    setLoading(true);
    try {
      await fetch(`/api/rooms/${roomSlug}/dj`, { method: "DELETE" });
      window.location.reload();
    } finally {
      setLoading(false);
    }
  };

  const orderedSlots = [...djSlots].sort((a, b) => a.position - b.position);
  const displaySlots: (DjSlot | null)[] = [];
  for (let i = 0; i < maxDjs; i++) {
    displaySlots.push(orderedSlots[i] || null);
  }

  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted">
          DJ Booth
        </h3>
        {djSlots.length === 0 && (
          <span className="text-xs text-accent">The booth is open.</span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {displaySlots.map((slot, i) => (
          <DJSlotComponent
            key={slot?.id || `empty-${i}`}
            slot={slot}
            isCurrentTurn={slot?.user_id === currentDjUserId}
            isCurrentUser={slot?.user_id === currentUserId}
          />
        ))}
      </div>

      {waitlist.length > 0 && (
        <div className="mb-4 text-xs text-muted">
          <span className="font-medium">Waitlist:</span>{" "}
          {waitlist.map((w) => w.user?.display_name).join(", ")}
        </div>
      )}

      {currentUserId && (
        <div className="flex gap-2">
          {!isUserDj && !isUserWaitlisted && (
            <button
              onClick={handleJoinBooth}
              disabled={loading}
              className="flex-1 text-sm bg-accent text-background py-2 rounded-full font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {djSlots.length >= maxDjs ? "Join Waitlist" : "Join DJ Booth"}
            </button>
          )}
          {(isUserDj || isUserWaitlisted) && (
            <button
              onClick={handleLeaveBooth}
              disabled={loading}
              className="flex-1 text-sm bg-surface-light text-muted py-2 rounded-full hover:text-foreground transition-colors disabled:opacity-50"
            >
              Leave Booth
            </button>
          )}
        </div>
      )}
    </div>
  );
}
