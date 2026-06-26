"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

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
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setUrl("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const submitDrop = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      onToast("Paste a link first");
      return;
    }
    if (!isDj) {
      onToast("Join a deck to drop tracks");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/rooms/${roomSlug}/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        onToast(data.error || "Failed to drop track");
        return;
      }
      setUrl("");
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
              ? "Paste a YouTube link — it goes straight to the queue."
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
            <input
              ref={inputRef}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitDrop()}
              placeholder="Paste a YouTube link…"
              disabled={!isDj}
              className="flex-1 min-w-0 bg-transparent border-none outline-none disabled:opacity-50"
              style={{ color: "var(--txt)", fontSize: 13 }}
            />
          </div>
          <button
            type="button"
            onClick={submitDrop}
            disabled={loading || !isDj}
            className="w-full font-display font-extrabold text-sm cursor-pointer border-none disabled:opacity-50"
            style={{
              padding: "13px 22px",
              borderRadius: 12,
              color: "#1a0d06",
              background: "linear-gradient(120deg, var(--glow2), var(--glow))",
              boxShadow: "0 6px 22px rgba(255, 157, 60, 0.55)",
            }}
          >
            {loading ? "…" : "Drop the Needle"}
          </button>
        </div>
      </div>
    </>
  );
}
