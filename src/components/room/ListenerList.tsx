"use client";

import { UserAvatar } from "@/components/shared/UserAvatar";
import type { RoomMember } from "@/lib/types";

interface ListenerListProps {
  members: RoomMember[];
  currentUserId: string | null;
}

export function ListenerList({ members, currentUserId }: ListenerListProps) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">
        In the Room ({members.length})
      </h3>

      <div className="flex flex-wrap gap-2">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center gap-2 bg-surface-light rounded-full pl-1 pr-3 py-1 animate-fade-in"
            title={member.user?.display_name || "Listener"}
          >
            <UserAvatar
              name={member.user?.display_name}
              avatarUrl={member.user?.avatar_url}
              size="sm"
              isActive={member.user_id === currentUserId}
            />
            <span className="text-xs truncate max-w-[80px]">
              {member.user?.display_name || "?"}
            </span>
          </div>
        ))}
      </div>

      {members.length === 0 && (
        <p className="text-sm text-muted italic">You&apos;re early. The room is yours.</p>
      )}
    </div>
  );
}
