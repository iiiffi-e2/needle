"use client";

import { useEffect, useState } from "react";
import type { RoomPlayback, Track, User } from "@/lib/types";
import { formatDuration } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface NowPlayingPanelProps {
  playback: RoomPlayback | null;
  track: Track | null;
  dj: User | null;
  votes: { awesome: number; lame: number };
  myVote: "awesome" | "lame" | null;
  userSaved: boolean;
  durationSeconds: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onVote: (dir: "awesome" | "lame") => void;
  onSave: () => void;
}

export function NowPlayingPanel({
  playback,
  track,
  dj,
  votes,
  myVote,
  userSaved,
  durationSeconds,
  isMuted,
  onToggleMute,
  onVote,
  onSave,
}: NowPlayingPanelProps) {
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState<string | null>(null);

  const duration = durationSeconds;

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
        isPaused && pausedAt
          ? new Date(pausedAt).getTime()
          : Date.now();
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

  const progress = duration
    ? (Math.min(elapsed, duration) / duration) * 100
    : 0;
  const upActive = myVote === "awesome";
  const downActive = myVote === "lame";

  const handleVote = async (dir: "awesome" | "lame") => {
    if (loading || !track) return;
    setLoading(dir);
    try {
      await onVote(dir);
    } finally {
      setLoading(null);
    }
  };

  const handleSave = async () => {
    if (userSaved || loading || !track) return;
    setLoading("save");
    try {
      await onSave();
    } finally {
      setLoading(null);
    }
  };

  const baseBtn =
    "flex-1 flex items-center justify-center gap-1.5 py-2 cursor-pointer rounded-[10px] font-extrabold text-xs";

  return (
    <div
      className="absolute z-30 rounded-2xl p-3.5 pointer-events-auto glass-panel hidden lg:block"
      style={{
        bottom: 18,
        left: 22,
        width: 344,
        maxWidth: "calc(100% - 44px)",
      }}
    >
      {!track ? (
        <div className="text-center py-4">
          <p className="font-display font-bold text-base">Nothing spinning</p>
          <p className="text-[var(--ndl-sub)] text-xs mt-1">
            DJs — drop a track to start
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-3">
            <div className="relative w-[74px] h-[74px] rounded-[10px] overflow-hidden shrink-0 bg-black shadow-[0_6px_16px_#0009]">
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
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="w-[34px] h-[34px] rounded-full bg-black flex items-center justify-center"
                  style={{
                    boxShadow: "inset 0 0 0 9px #ffffff22",
                    animation: "ndl-spin 3s linear infinite",
                  }}
                >
                  <span
                    className="w-[7px] h-[7px] rounded-full"
                    style={{ background: "var(--ndl-glow2)" }}
                  />
                </div>
              </div>
              {track.provider === "youtube" && (
                <span className="absolute bottom-1 right-1 text-[7px] font-extrabold tracking-wide text-white bg-[#cc0000] px-1 rounded-sm">
                  YT
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div
                className="font-bold uppercase mb-0.5"
                style={{
                  fontSize: 9.5,
                  letterSpacing: "0.14em",
                  color: "var(--ndl-glow2)",
                }}
              >
                Now spinning
              </div>
              <div className="font-display font-bold text-base leading-tight truncate">
                {track.title}
              </div>
              {track.artist && (
                <div
                  className="text-xs truncate"
                  style={{ color: "var(--ndl-sub)" }}
                >
                  {track.artist}
                </div>
              )}
              {dj && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{
                      background:
                        "linear-gradient(140deg, var(--ndl-accent), var(--ndl-glow))",
                    }}
                  />
                  <span className="text-[11px]" style={{ color: "var(--ndl-sub)" }}>
                    played by{" "}
                    <b className="font-bold" style={{ color: "var(--ndl-txt)" }}>
                      {dj.display_name}
                    </b>
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={onToggleMute}
              title={isMuted ? "Unmute" : "Mute"}
              aria-label={isMuted ? "Unmute" : "Mute"}
              aria-pressed={isMuted}
              className={cn(
                "w-[30px] h-[30px] shrink-0 cursor-pointer rounded-[8px] text-sm flex items-center justify-center",
                isMuted
                  ? "bg-[color-mix(in_srgb,#ff9d3c_25%,transparent)] border border-[var(--ndl-glow)] text-[var(--ndl-glow)]"
                  : "bg-[#ffffff10] border border-[var(--ndl-line)] text-[var(--ndl-sub)] hover:text-[var(--ndl-txt)]"
              )}
            >
              {isMuted ? "🔇" : "🔊"}
            </button>
            <span
              className="text-[10px] tabular-nums w-[34px] shrink-0"
              style={{ color: "var(--ndl-sub)" }}
            >
              {formatDuration(Math.floor(elapsed))}
            </span>
            <div className="flex-1 h-[5px] rounded-sm bg-[#ffffff1a] overflow-hidden">
              <div
                className="h-full rounded-sm"
                style={{
                  width: `${progress}%`,
                  background:
                    "linear-gradient(90deg, var(--ndl-glow), var(--ndl-glow2))",
                  boxShadow: "0 0 10px var(--ndl-glow)",
                  transition: "width 250ms linear",
                }}
              />
            </div>
            <span
              className="text-[10px] tabular-nums w-[34px] shrink-0 text-right"
              style={{ color: "var(--ndl-sub)" }}
            >
              {formatDuration(Math.floor(duration))}
            </span>
          </div>

          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => handleVote("awesome")}
              disabled={!!loading}
              className={cn(
                baseBtn,
                "border-none text-[#11240f]",
                upActive
                  ? "bg-gradient-to-br from-[#62e08a] to-[#2bbf6a] shadow-[0_0_0_2px_#62e08a,0_0_16px_#2bbf6a] animate-ndl-pop"
                  : "bg-gradient-to-br from-[#62e08a] to-[#2bbf6a] shadow-[0_4px_14px_#2bbf6a44]"
              )}
            >
              ▲ Awesome <b className="tabular-nums">{votes.awesome}</b>
            </button>
            <button
              type="button"
              onClick={() => handleVote("lame")}
              disabled={!!loading}
              className={cn(
                baseBtn,
                downActive
                  ? "text-[var(--ndl-txt)] bg-[color-mix(in_srgb,#ff5a5a_30%,transparent)] border border-[#ff5a5a]"
                  : "text-[var(--ndl-sub)] bg-[#ffffff10] border border-[var(--ndl-line)]"
              )}
            >
              ▼ Lame
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={userSaved || !!loading}
              title="Save to crate"
              className={cn(
                "w-[42px] cursor-pointer rounded-[10px] text-base flex items-center justify-center",
                userSaved
                  ? "bg-[color-mix(in_srgb,#ff6fae_30%,transparent)] border border-[#ff6fae] text-[#ff6fae]"
                  : "bg-[#ffffff10] border border-[var(--ndl-line)]"
              )}
              style={userSaved ? undefined : { color: "var(--ndl-glow2)" }}
            >
              {userSaved ? "♥" : "♡"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
