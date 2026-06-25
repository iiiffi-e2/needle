"use client";

import type { Room } from "@/lib/types";

interface RoomVibePanelProps {
  room: Room;
}

export function RoomVibePanel({ room }: RoomVibePanelProps) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
        Room Vibe
      </h3>

      {room.vibe && (
        <p className="text-sm leading-relaxed mb-4">{room.vibe}</p>
      )}

      {room.description && (
        <p className="text-xs text-muted leading-relaxed mb-4">
          {room.description}
        </p>
      )}

      {room.tags && room.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {room.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs bg-surface-light text-muted px-2.5 py-1 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
