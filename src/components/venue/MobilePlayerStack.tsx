"use client";

import { QuickReacts } from "@/components/venue/QuickReacts";
import { MobileNowPlayingBar } from "@/components/venue/MobileNowPlayingBar";
import type { RoomPlayback, Track, User } from "@/lib/types";

interface MobilePlayerStackProps {
  roomSlug: string;
  playback: RoomPlayback | null;
  track: Track | null;
  dj: User | null;
  myVote: "awesome" | "lame" | null;
  userSaved: boolean;
  durationSeconds: number;
  onReact: (glyph: string, color: string, type: string) => void;
  onVote: (dir: "awesome" | "lame") => void;
  onSave: () => void;
}

export function MobilePlayerStack({
  roomSlug,
  playback,
  track,
  dj,
  myVote,
  userSaved,
  durationSeconds,
  onReact,
  onVote,
  onSave,
}: MobilePlayerStackProps) {
  return (
    <div className="needle-mobile-player-stack lg:hidden">
      <QuickReacts roomSlug={roomSlug} onReact={onReact} layout="inline" />
      {track && (
        <MobileNowPlayingBar
          playback={playback}
          track={track}
          dj={dj}
          myVote={myVote}
          userSaved={userSaved}
          durationSeconds={durationSeconds}
          onVote={onVote}
          onSave={onSave}
        />
      )}
    </div>
  );
}
