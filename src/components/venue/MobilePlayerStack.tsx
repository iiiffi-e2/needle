"use client";

import { QuickReacts } from "@/components/venue/QuickReacts";
import { MobileNowPlayingBar } from "@/components/venue/MobileNowPlayingBar";
import { StageViewToggle } from "@/components/venue/StageViewToggle";
import type { StageViewMode } from "@/lib/stage-view";
import type { RoomPlayback, Track, User } from "@/lib/types";

interface MobilePlayerStackProps {
  roomSlug: string;
  playback: RoomPlayback | null;
  track: Track | null;
  dj: User | null;
  myVote: "awesome" | "lame" | null;
  userSaved: boolean;
  durationSeconds: number;
  isMuted: boolean;
  canSkip: boolean;
  stageViewMode: StageViewMode;
  onStageViewChange: (mode: StageViewMode) => void;
  onToggleMute: () => void;
  onReact: (glyph: string, color: string, type: string) => void;
  onVote: (dir: "awesome" | "lame") => void;
  onSave: () => void;
  onSkip: () => void;
}

export function MobilePlayerStack({
  roomSlug,
  playback,
  track,
  dj,
  myVote,
  userSaved,
  durationSeconds,
  isMuted,
  canSkip,
  stageViewMode,
  onStageViewChange,
  onToggleMute,
  onReact,
  onVote,
  onSave,
  onSkip,
}: MobilePlayerStackProps) {
  return (
    <div className="needle-mobile-player-stack lg:hidden">
      {stageViewMode === "full" && (
        <div className="flex justify-end pr-1">
          <StageViewToggle value={stageViewMode} onChange={onStageViewChange} />
        </div>
      )}
      <QuickReacts roomSlug={roomSlug} onReact={onReact} layout="inline" />
      {track && (
        <MobileNowPlayingBar
          playback={playback}
          track={track}
          dj={dj}
          myVote={myVote}
          userSaved={userSaved}
          durationSeconds={durationSeconds}
          isMuted={isMuted}
          canSkip={canSkip}
          onToggleMute={onToggleMute}
          onVote={onVote}
          onSave={onSave}
          onSkip={onSkip}
        />
      )}
    </div>
  );
}
