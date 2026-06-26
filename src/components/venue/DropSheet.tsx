"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { TrackSearchInput } from "@/components/shared/TrackSearchInput";

interface DropSheetProps {
  open: boolean;
  roomSlug: string;
  isDj: boolean;
  onClose: () => void;
  onOpenQueue: () => void;
  onToast: (msg: string) => void;
}

export function DropSheet({
  open,
  roomSlug,
  isDj,
  onClose,
  onOpenQueue,
  onToast,
}: DropSheetProps) {
  const [loading, setLoading] = useState(false);

  const submitUrl = async (url: string) => {
    if (!isDj) {
      onToast("Join a deck to drop tracks");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/rooms/${roomSlug}/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast(data.error || "Failed to drop track");
        return;
      }
      onToast("Added to the queue");
      onOpenQueue();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="needle-mobile-backdrop lg:hidden"
        aria-label="Close drop sheet"
        onClick={onClose}
      />
      <div
        className={cn(
          "needle-mobile-sheet lg:hidden",
          "needle-mobile-sheet-open"
        )}
        role="dialog"
        aria-label="Drop a track"
      >
        <div className="needle-mobile-sheet-handle" />
        <div className="px-4 pb-4 pt-1">
          <h2 className="font-display font-extrabold text-[17px] mb-1">
            Drop a track
          </h2>
          <p className="text-[12px] mb-4" style={{ color: "var(--sub)" }}>
            {isDj
              ? "Search for a track or paste a YouTube link — it goes straight to the queue."
              : "Join a deck on stage to drop tracks."}
          </p>
          <div
            className="flex items-center gap-2.5 px-3.5 mb-3"
            style={{
              height: 46,
              borderRadius: 12,
              background: "#00000040",
              border: "1px solid var(--line)",
            }}
          >
            <span className="text-base text-[#cc0000] font-extrabold shrink-0">
              ▸
            </span>
            <TrackSearchInput
              autoFocus
              disabled={loading || !isDj}
              onSelect={(_videoId, url) => void submitUrl(url)}
            />
          </div>
        </div>
      </div>
    </>
  );
}
