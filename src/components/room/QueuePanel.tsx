"use client";

import type { QueueItem, User } from "@/lib/types";
import { UserAvatar } from "@/components/shared/UserAvatar";

interface QueuePanelProps {
  queueItems: QueueItem[];
  currentDjUserId: string | null;
  djSlots: { user_id: string; user?: User }[];
}

export function QueuePanel({
  queueItems,
  currentDjUserId,
  djSlots,
}: QueuePanelProps) {
  const currentDj = djSlots.find((s) => s.user_id === currentDjUserId);
  const currentIndex = djSlots.findIndex((s) => s.user_id === currentDjUserId);
  const nextDj =
    djSlots.length > 0
      ? djSlots[(currentIndex + 1) % djSlots.length]
      : null;

  const getQueuedTrack = (userId: string) =>
    queueItems.find((q) => q.dj_user_id === userId);

  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-4">
        Queue
      </h3>

      {currentDj && (
        <div className="mb-3 p-3 rounded-xl bg-accent/5 border border-accent/10">
          <p className="text-xs text-accent font-medium mb-1">Current DJ</p>
          <div className="flex items-center gap-2">
            <UserAvatar
              name={currentDj.user?.display_name}
              avatarUrl={currentDj.user?.avatar_url}
              userId={currentDj.user_id}
              avatarColor={currentDj.user?.avatar_color}
              size="sm"
            />
            <span className="text-sm font-medium">
              {currentDj.user?.display_name}
            </span>
          </div>
        </div>
      )}

      {nextDj && nextDj.user_id !== currentDjUserId && (
        <div className="mb-3 p-3 rounded-xl bg-surface-light">
          <p className="text-xs text-muted font-medium mb-1">Up Next</p>
          <div className="flex items-center gap-2">
            <UserAvatar
              name={nextDj.user?.display_name}
              avatarUrl={nextDj.user?.avatar_url}
              userId={nextDj.user_id}
              avatarColor={nextDj.user?.avatar_color}
              size="sm"
            />
            <span className="text-sm">{nextDj.user?.display_name}</span>
            {getQueuedTrack(nextDj.user_id)?.track ? (
              <span className="text-xs text-muted ml-auto truncate max-w-[120px]">
                {getQueuedTrack(nextDj.user_id)?.track?.title}
              </span>
            ) : (
              <span className="text-xs text-muted ml-auto italic">
                No track yet
              </span>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {djSlots.map((slot) => {
          const queued = getQueuedTrack(slot.user_id);
          return (
            <div
              key={slot.user_id}
              className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-light/50 transition-colors"
            >
              <UserAvatar
                name={slot.user?.display_name}
                avatarUrl={slot.user?.avatar_url}
                userId={slot.user_id}
                avatarColor={slot.user?.avatar_color}
                size="sm"
              />
              {queued?.track ? (
                <div className="min-w-0 flex-1">
                  <p className="text-sm truncate">{queued.track.title}</p>
                </div>
              ) : (
                <p className="text-sm text-muted italic flex-1">
                  Waiting for a track...
                </p>
              )}
            </div>
          );
        })}
      </div>

      {djSlots.length === 0 && (
        <p className="text-sm text-muted italic text-center py-4">
          No DJs in the booth yet.
        </p>
      )}
    </div>
  );
}
