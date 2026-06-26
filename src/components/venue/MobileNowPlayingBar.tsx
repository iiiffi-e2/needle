"use client";

import { useEffect, useState } from "react";
import type { RoomPlayback, Track, User } from "@/lib/types";
import { formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { MarqueeText } from "@/components/shared/MarqueeText";

interface MobileNowPlayingBarProps {
  playback: RoomPlayback | null;
  track: Track | null;
  dj: User | null;
  myVote: "awesome" | "lame" | null;
  userSaved: boolean;
  durationSeconds: number;
  onVote: (dir: "awesome" | "lame") => void;
  onSave: () => void;
}

export function MobileNowPlayingBar({
  playback,
  track,
  dj,
  myVote,
  userSaved,
  durationSeconds,
  onVote,
  onSave,
}: MobileNowPlayingBarProps) {
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!playback?.started_at) {
      setElapsed(0);
      return;
    }

    const startedAt = playback.started_at;
    const pausedAt = playback.paused_at;
    const isPaused = playback.is_paused;

    const tick = () => {
      const startedMs = new Date(startedAt).getTime();
      const endMs =
        isPaused && pausedAt ? new Date(pausedAt).getTime() : Date.now();
      setElapsed(Math.max(0, (endMs - startedMs) / 1000));
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [
    playback?.started_at,
    playback?.paused_at,
    playback?.is_paused,
    track?.id,
  ]);

  if (!track) return null;

  const handleVote = async () => {
    if (loading) return;
    setLoading("awesome");
    try {
      await onVote("awesome");
    } finally {
      setLoading(null);
    }
  };

  const handleSave = async () => {
    if (userSaved || loading) return;
    setLoading("save");
    try {
      await onSave();
    } finally {
      setLoading(null);
    }
  };

  const upActive = myVote === "awesome";

  return (
    <div
      className="needle-mobile-now-playing-inner glass-panel pointer-events-auto"
      role="region"
      aria-label="Now playing"
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-black">
          {track.thumbnail_url ? (
            <img
              src={track.thumbnail_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--ndl-glow) 60%, #000), color-mix(in srgb, var(--ndl-neon) 60%, #000))",
              }}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <MarqueeText
            text={track.title}
            className="font-display font-bold text-[13px] leading-tight"
          />
          <div
            className="text-[11px] truncate tabular-nums"
            style={{ color: "var(--sub)" }}
          >
            {dj?.display_name || "DJ"} · {formatDuration(Math.floor(elapsed))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handleVote}
          disabled={!!loading}
          aria-label="Vote awesome"
          className={cn(
            "w-9 h-9 rounded-[10px] border-none cursor-pointer flex items-center justify-center text-sm font-extrabold disabled:opacity-50",
            upActive
              ? "bg-gradient-to-br from-[#62e08a] to-[#2bbf6a] text-[#11240f] shadow-[0_0_0_2px_#62e08a]"
              : "bg-gradient-to-br from-[#62e08a] to-[#2bbf6a] text-[#11240f]"
          )}
        >
          ▲
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={userSaved || !!loading}
          aria-label="Save to crate"
          className={cn(
            "w-9 h-9 rounded-[10px] cursor-pointer flex items-center justify-center text-base border disabled:opacity-50",
            userSaved
              ? "bg-[color-mix(in_srgb,#ff6fae_30%,transparent)] border-[#ff6fae] text-[#ff6fae]"
              : "bg-[#ffffff10] border-[var(--line)]"
          )}
          style={userSaved ? undefined : { color: "var(--glow2)" }}
        >
          {userSaved ? "♥" : "♡"}
        </button>
      </div>
    </div>
  );
}
