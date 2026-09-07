"use client";

import { YouTubePlayer } from "@/components/room/YouTubePlayer";
import { StageViewToggle } from "@/components/venue/StageViewToggle";
import { cn } from "@/lib/utils";
import type { StageViewMode } from "@/lib/stage-view";
import type { Track } from "@/lib/types";

interface YouTubeStageProps {
  mode: StageViewMode;
  onModeChange: (mode: StageViewMode) => void;
  track: Track | null;
  videoId: string | null;
  sessionId: string | null;
  startedAt: string | null;
  durationSeconds: number | null;
  isPaused: boolean;
  muted: boolean;
  onEnded: (sessionId: string) => void;
  onDurationReady?: (seconds: number) => void;
  onAutoplayMuted?: (blocked: boolean) => void;
}

export function YouTubeStage({
  mode,
  onModeChange,
  track,
  videoId,
  sessionId,
  startedAt,
  durationSeconds,
  isPaused,
  muted,
  onEnded,
  onDurationReady,
  onAutoplayMuted,
}: YouTubeStageProps) {
  const hasPlayer = Boolean(videoId && sessionId);
  const title = track?.title ?? null;
  const artist = track?.artist ?? null;

  return (
    <section
      className={cn(
        "youtube-stage",
        mode === "full" ? "youtube-stage--full" : "youtube-stage--compact"
      )}
      aria-label="Stage screen"
    >
      <div className="youtube-stage__chrome">
        <div className="youtube-stage__identity">
          <span className="youtube-stage__live" aria-hidden />
          <span className="youtube-stage__kicker">Stage Screen</span>
          {title && mode === "compact" && (
            <span className="youtube-stage__chrome-title">{title}</span>
          )}
        </div>
        <StageViewToggle value={mode} onChange={onModeChange} />
      </div>

      <div className="youtube-stage__screen">
        {hasPlayer ? (
          <YouTubePlayer
            videoId={videoId!}
            sessionId={sessionId!}
            startedAt={startedAt}
            durationSeconds={durationSeconds}
            isPaused={isPaused}
            muted={muted}
            onEnded={onEnded}
            onDurationReady={onDurationReady}
            onAutoplayMuted={onAutoplayMuted}
          />
        ) : track?.thumbnail_url ? (
          <img
            src={track.thumbnail_url}
            alt=""
            className="youtube-stage__poster"
          />
        ) : (
          <div className="youtube-stage__idle">
            <span className="youtube-stage__idle-glyph" aria-hidden>
              ♪
            </span>
            <p>Nothing spinning</p>
            <p>Drop a track and the booth screen lights up.</p>
          </div>
        )}
      </div>

      {mode === "full" && title && (
        <div className="youtube-stage__meta">
          <p className="youtube-stage__title">{title}</p>
          {artist && <p className="youtube-stage__artist">{artist}</p>}
        </div>
      )}
    </section>
  );
}
