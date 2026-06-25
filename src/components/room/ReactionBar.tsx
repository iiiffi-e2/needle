"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface ReactionBarProps {
  roomSlug: string;
  votes: { awesome: number; lame: number };
  userVotes: string[];
  userSaved: boolean;
  hasTrack: boolean;
}

export function ReactionBar({
  roomSlug,
  votes,
  userVotes,
  userSaved,
  hasTrack,
}: ReactionBarProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [localVotes, setLocalVotes] = useState(votes);
  const [localUserVotes, setLocalUserVotes] = useState(userVotes);
  const [localSaved, setLocalSaved] = useState(userSaved);

  if (!hasTrack) return null;

  const handleVote = async (voteType: "awesome" | "lame") => {
    if (localUserVotes.includes(voteType) || loading) return;
    setLoading(voteType);

    try {
      const res = await fetch(`/api/rooms/${roomSlug}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voteType }),
      });

      if (res.ok) {
        setLocalUserVotes((prev) => [...prev, voteType]);
        setLocalVotes((prev) => ({
          ...prev,
          [voteType]: prev[voteType] + 1,
        }));

        const data = await res.json();
        if (data.skipped) {
          // Room state will update via realtime
        }
      }
    } finally {
      setLoading(null);
    }
  };

  const handleSave = async () => {
    if (localSaved || loading) return;
    setLoading("save");

    try {
      const res = await fetch(`/api/rooms/${roomSlug}/save`, {
        method: "POST",
      });

      if (res.ok) {
        setLocalSaved(true);
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-3 mt-5 pt-4 border-t border-white/5">
      <button
        onClick={() => handleVote("awesome")}
        disabled={localUserVotes.includes("awesome") || !!loading}
        className={cn(
          "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all",
          localUserVotes.includes("awesome")
            ? "bg-success/20 text-success"
            : "bg-surface-light hover:bg-success/10 text-muted hover:text-success"
        )}
      >
        🔥 Awesome
        <span className="text-xs opacity-70">{localVotes.awesome}</span>
      </button>

      <button
        onClick={() => handleVote("lame")}
        disabled={localUserVotes.includes("lame") || !!loading}
        className={cn(
          "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all",
          localUserVotes.includes("lame")
            ? "bg-danger/20 text-danger"
            : "bg-surface-light hover:bg-danger/10 text-muted hover:text-danger"
        )}
      >
        💀 Lame
        <span className="text-xs opacity-70">{localVotes.lame}</span>
      </button>

      <button
        onClick={handleSave}
        disabled={localSaved || !!loading}
        className={cn(
          "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all ml-auto",
          localSaved
            ? "bg-accent-secondary/20 text-accent-secondary"
            : "bg-surface-light hover:bg-accent-secondary/10 text-muted hover:text-accent-secondary"
        )}
      >
        {localSaved ? "❤️ Saved" : "♡ Save"}
      </button>
    </div>
  );
}
