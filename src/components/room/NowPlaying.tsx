"use client";

import { useEffect, useState } from "react";
import { YouTubePlayer } from "./YouTubePlayer";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { ReactionBar } from "./ReactionBar";
import type { RoomPlayback, Track, User } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

interface NowPlayingProps {
  playback: RoomPlayback | null;
  track: Track | null;
  dj: User | null;
  votes: { awesome: number; lame: number };
  userVotes: string[];
  userSaved: boolean;
  roomSlug: string;
  onTrackEnded: () => void;
}

function Equalizer() {
  return (
    <div className="flex items-end gap-0.5 h-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="w-1 bg-accent rounded-full"
          style={{
            animation: `equalizer 0.${8 + i}s ease-in-out infinite`,
            animationDelay: `${i * 0.15}s`,
            height: "60%",
          }}
        />
      ))}
    </div>
  );
}

export function NowPlaying({
  playback,
  track,
  dj,
  votes,
  userVotes,
  userSaved,
  roomSlug,
  onTrackEnded,
}: NowPlayingProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  useEffect(() => {
    if (!playback?.started_at || !track?.duration_seconds) return;

    const update = () => {
      const elapsed =
        (Date.now() - new Date(playback.started_at!).getTime()) / 1000;
      const remaining = Math.max(0, (track.duration_seconds || 0) - elapsed);
      setTimeRemaining(formatDuration(Math.floor(remaining)));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [playback?.started_at, track?.duration_seconds]);

  if (!track || !playback?.current_track_id) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center glow-accent">
        <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-surface-light flex items-center justify-center">
          <span className="text-5xl opacity-50">🎵</span>
        </div>
        <h2 className="text-xl font-semibold mb-2">Nothing playing yet</h2>
        <p className="text-muted text-sm">
          DJs — add your track to get this room moving.
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl p-6 glow-accent">
      <div className="flex items-center gap-2 mb-4">
        <Equalizer />
        <span className="text-xs text-accent font-medium uppercase tracking-wider">
          Now Playing
        </span>
      </div>

      {track.provider === "youtube" && track.provider_id ? (
        <YouTubePlayer
          videoId={track.provider_id}
          startedAt={playback.started_at}
          durationSeconds={track.duration_seconds}
          isPaused={playback.is_paused}
          onEnded={onTrackEnded}
        />
      ) : (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-surface-light flex items-center justify-center">
          {track.thumbnail_url ? (
            <img
              src={track.thumbnail_url}
              alt={track.title}
              className={`w-48 h-48 rounded-full object-cover ${playback && !playback.is_paused ? "animate-spin-slow" : ""}`}
            />
          ) : (
            <span className="text-6xl opacity-30">🎵</span>
          )}
        </div>
      )}

      <div className="mt-5">
        <h2 className="text-xl sm:text-2xl font-bold leading-tight">
          {track.title}
        </h2>
        {track.artist && (
          <p className="text-muted mt-1">{track.artist}</p>
        )}

        {dj && (
          <div className="flex items-center gap-2 mt-3">
            <UserAvatar name={dj.display_name} avatarUrl={dj.avatar_url} size="sm" />
            <span className="text-sm text-muted">
              Played by{" "}
              <span className="text-foreground">{dj.display_name}</span>
            </span>
          </div>
        )}

        {timeRemaining && (
          <p className="text-xs text-muted mt-2">{timeRemaining} remaining</p>
        )}
      </div>

      <ReactionBar
        roomSlug={roomSlug}
        votes={votes}
        userVotes={userVotes}
        userSaved={userSaved}
        hasTrack={!!track}
      />
    </div>
  );
}
