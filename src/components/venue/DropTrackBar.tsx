"use client";

import { useState } from "react";
import { TrackSearchInput } from "@/components/shared/TrackSearchInput";

interface DropTrackBarProps {
  roomSlug: string;
  isDj: boolean;
  onOpenCrate: () => void;
  onOpenQueue: () => void;
  onToast: (msg: string) => void;
}

export function DropTrackBar({
  roomSlug,
  isDj,
  onOpenCrate,
  onOpenQueue,
  onToast,
}: DropTrackBarProps) {
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
    } finally {
      setLoading(false);
    }
  };

  if (!isDj) return null;

  return (
    <div
      className="relative z-40 shrink-0 hidden lg:flex items-center gap-3 px-[22px]"
      style={{
        height: 80,
        borderTop: "1px solid var(--line)",
        background:
          "linear-gradient(180deg, transparent, rgba(28, 18, 11, 0.8))",
      }}
    >
      <button
        type="button"
        onClick={onOpenCrate}
        className="flex items-center gap-2 font-bold text-[13px] cursor-pointer shrink-0"
        style={{
          padding: "11px 16px",
          borderRadius: 12,
          border: "1px solid var(--line)",
          background: "#ffffff0d",
          color: "var(--txt)",
        }}
      >
        <span
          className="inline-block w-[18px] h-[18px] rounded"
          style={{
            background: "linear-gradient(135deg, var(--glow), var(--accent))",
          }}
        />
        Open Crate
      </button>

      <div
        className="flex-1 flex items-center gap-2.5 min-w-0 px-3.5"
        style={{
          height: 46,
          borderRadius: 12,
          background: "#00000040",
          border: "1px solid var(--line)",
        }}
      >
        <span className="text-base text-[#cc0000] font-extrabold shrink-0">▸</span>
        <TrackSearchInput
          disabled={loading}
          onSelect={(_videoId, url) => void submitUrl(url)}
        />
        <span
          className="text-[11px] shrink-0 hidden sm:inline"
          style={{
            color: "var(--sub)",
            border: "1px solid var(--line)",
            borderRadius: 6,
            padding: "2px 7px",
          }}
        >
          ⏎
        </span>
      </div>
    </div>
  );
}
