"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "needle_dj_drop_hint_seen";

interface DjDropHintProps {
  isDj: boolean;
  onDismiss?: () => void;
}

export function DjDropHint({ isDj, onDismiss }: DjDropHintProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isDj) {
      setVisible(false);
      return;
    }
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    setVisible(true);
  }, [isDj]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
    onDismiss?.();
  };

  if (!visible) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[45] cursor-default"
        aria-label="Dismiss hint"
        onClick={dismiss}
      />
      <div
        className="absolute left-[22px] right-[22px] bottom-full mb-2 z-[46] px-4 py-3 rounded-xl text-[13px] font-bold shadow-lg"
        style={{
          background: "linear-gradient(120deg, var(--glow2), var(--glow))",
          color: "#1a0d06",
        }}
      >
        Search for a track or paste a YouTube link, then pick a result to drop.
        <button
          type="button"
          onClick={dismiss}
          className="ml-2 underline bg-transparent border-none cursor-pointer font-bold"
          style={{ color: "#1a0d06" }}
        >
          Got it
        </button>
      </div>
    </>
  );
}

export function markDjDropHintSeen(): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, "1");
  }
}
