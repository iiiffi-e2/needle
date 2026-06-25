import Link from "next/link";
import type { RoomWithStats } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

interface RoomCardProps {
  room: RoomWithStats;
}

export function RoomCard({ room }: RoomCardProps) {
  return (
    <Link
      href={`/rooms/${room.slug}`}
      className="glass-card rounded-2xl p-5 hover:border-accent/20 transition-all duration-300 hover:glow-accent group block"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-semibold group-hover:text-accent transition-colors">
          {room.name}
        </h3>
        <span className="text-xs text-success bg-success/10 px-2 py-0.5 rounded-full">
          Live
        </span>
      </div>

      {room.vibe && (
        <p className="text-sm text-muted mb-4 line-clamp-2">{room.vibe}</p>
      )}

      {room.current_track ? (
        <div className="flex items-center gap-3 mb-4 p-2 rounded-lg bg-surface-light/50">
          {room.current_track.thumbnail_url && (
            <img
              src={room.current_track.thumbnail_url}
              alt=""
              className="w-10 h-10 rounded object-cover"
            />
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {room.current_track.title}
            </p>
            {room.current_track.duration_seconds && (
              <p className="text-xs text-muted">
                {formatDuration(room.current_track.duration_seconds)}
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted mb-4 italic">The booth is open.</p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted">
          <span>👥 {room.listener_count}</span>
          <span>🎤 {room.dj_count}</span>
        </div>

        {room.tags && room.tags.length > 0 && (
          <div className="flex gap-1">
            {room.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-xs text-muted bg-surface-light px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 text-center">
        <span className="text-sm font-medium text-accent group-hover:underline">
          Join Room →
        </span>
      </div>
    </Link>
  );
}
