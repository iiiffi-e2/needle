"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface EmailCaptureProps {
  compact?: boolean;
  successMessage?: string;
  isLoggedIn?: boolean;
}

export function EmailCapture({
  compact = false,
  successMessage = "You're in. Opening The FIRST Room Ever…",
  isLoggedIn = false,
}: EmailCaptureProps) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/.+@.+\..+/.test(email.trim())) return;

    setSubmitted(true);
    window.setTimeout(() => {
      router.push(`/auth/signup?email=${encodeURIComponent(email.trim())}`);
    }, 1200);
  };

  if (isLoggedIn) {
    return (
      <Link
        href="/rooms"
        className="inline-flex items-center gap-2 rounded-[30px] border-none cursor-pointer font-display font-extrabold text-[#1a0d06] bg-[linear-gradient(120deg,var(--glow2),var(--glow))] shadow-[0_4px_18px_color-mix(in_srgb,var(--glow)_50%,transparent)] whitespace-nowrap hover:opacity-95 transition-opacity"
        style={{
          padding: compact ? "13px 26px" : "14px 30px",
          fontSize: compact ? "15px" : "16px",
        }}
      >
        Browse live rooms →
      </Link>
    );
  }

  if (submitted) {
    return (
      <div
        className="flex items-center gap-3 rounded-[40px] border border-[color-mix(in_srgb,var(--glow)_40%,transparent)] bg-[color-mix(in_srgb,var(--glow)_14%,transparent)]"
        style={{ padding: compact ? "15px 26px" : "16px 30px" }}
      >
        <span className="text-[22px]">🎧</span>
        <span
          className="font-bold text-[var(--glow2)]"
          style={{ fontSize: compact ? "15px" : "16px" }}
        >
          {successMessage}
        </span>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-[9px] rounded-[40px] border border-[var(--line)] bg-black/40 backdrop-blur-[10px] shadow-[0_14px_40px_#0008]"
      style={{ padding: "7px", width: compact ? "fit-content" : undefined }}
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        required
        className="bg-transparent border-none outline-none text-[var(--txt)] font-[inherit] placeholder:text-[var(--sub)]"
        style={{
          width: compact ? 260 : 280,
          fontSize: compact ? 15 : 15,
          padding: "0 18px",
        }}
      />
      <button
        type="submit"
        className="rounded-[30px] border-none cursor-pointer font-display font-extrabold text-[#1a0d06] bg-[linear-gradient(120deg,var(--glow2),var(--glow))] shadow-[0_4px_18px_color-mix(in_srgb,var(--glow)_50%,transparent)] whitespace-nowrap hover:opacity-95 transition-opacity"
        style={{ padding: compact ? "13px 26px" : "14px 30px", fontSize: compact ? 15 : 16 }}
      >
        Drop in free →
      </button>
    </form>
  );
}
