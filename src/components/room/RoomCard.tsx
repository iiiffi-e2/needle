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
      className="glass-card rounded-2xl p-5 hover:border-[color-mix(in_srgb,var(--ndl-glow)_35%,transparent)] transition-all duration-300 group block"
      style={{
        boxShadow: "0 0 0 0 transparent",
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-display text-lg font-extrabold group-hover:text-glow-soft transition-colors">
          {room.name}
        </h3>
        <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full border border-[color-mix(in_srgb,#36e07f_40%,transparent)] bg-[color-mix(in_srgb,#36e07f_15%,transparent)] text-[#36e07f]">
          LIVE
        </span>
      </div>

      {room.vibe && (
        <p className="text-sm text-muted mb-4 line-clamp-2">{room.vibe}</p>
      )}

      {room.current_track ? (
        <div className="flex items-center gap-3 mb-4 p-2 rounded-lg bg-[#ffffff08] border border-[var(--ndl-line)]">
          {room.current_track.thumbnail_url && (
            <img
              src={room.current_track.thumbnail_url}
              alt=""
              className="w-10 h-10 rounded object-cover"
            />
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{room.current_track.title}</p>
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
        <div className="flex items-center gap-3 text-xs text-muted font-medium">
          <span>{room.listener_count} listening</span>
          <span>{room.dj_count} on deck</span>
        </div>

        {room.tags && room.tags.length > 0 && (
          <div className="flex gap-1">
            {room.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-xs text-muted bg-[#ffffff08] border border-[var(--ndl-line)] px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 text-center">
        <span className="text-sm font-bold text-glow-soft group-hover:underline">
          Enter the room →
        </span>
      </div>
    </Link>
  );
}
