"use client";

import Link from "next/link";
import { EmailCapture } from "./EmailCapture";

interface LandingNavProps {
  isLoggedIn?: boolean;
}

export function LandingNav({ isLoggedIn = false }: LandingNavProps) {
  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className="sticky top-0 z-[80] flex items-center gap-3.5 px-4 sm:px-8 lg:px-14 py-5 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--bg0)_95%,transparent),transparent)] backdrop-blur-sm">
      <Link href="/" className="flex items-center gap-[11px]">
        <div
          className="relative w-[34px] h-[34px] rounded-full"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, var(--bg1) 0 22%, var(--glow) 23% 30%, var(--bg1) 31% 46%, var(--glow2) 47% 52%, var(--bg1) 53%)",
            boxShadow: "0 0 16px color-mix(in srgb, var(--glow) 60%, transparent)",
          }}
        >
          <div className="absolute w-[5px] h-[5px] rounded-full bg-[var(--txt)] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <span className="font-display font-extrabold text-[22px] tracking-[-0.02em]">
          Needle
        </span>
      </Link>

      <div className="flex-1" />

      <nav className="landing-nav-links hidden md:flex items-center gap-6 lg:gap-[30px] mr-2">
        <button
          type="button"
          onClick={() => scrollTo("rooms")}
          className="text-sm text-[var(--sub)] hover:text-[var(--txt)] transition-colors cursor-pointer bg-transparent border-none font-[inherit]"
        >
          Rooms
        </button>
        <button
          type="button"
          onClick={() => scrollTo("features")}
          className="text-sm text-[var(--sub)] hover:text-[var(--txt)] transition-colors cursor-pointer bg-transparent border-none font-[inherit]"
        >
          How it works
        </button>
        <button
          type="button"
          onClick={() => scrollTo("vibe")}
          className="text-sm text-[var(--sub)] hover:text-[var(--txt)] transition-colors cursor-pointer bg-transparent border-none font-[inherit]"
        >
          The vibe
        </button>
      </nav>

      {isLoggedIn ? (
        <Link
          href="/rooms"
          className="text-sm font-semibold text-[var(--txt)] hover:text-[var(--glow2)] transition-colors"
        >
          Live rooms
        </Link>
      ) : (
        <Link
          href="/auth/login"
          className="text-sm font-semibold text-[var(--txt)] hover:text-[var(--glow2)] transition-colors"
        >
          Sign in
        </Link>
      )}

      {isLoggedIn ? (
        <Link
          href="/rooms"
          className="px-5 py-2.5 rounded-[30px] border-none cursor-pointer font-[inherit] font-extrabold text-sm text-[#1a0d06] bg-[linear-gradient(120deg,var(--glow2),var(--glow))] shadow-[0_4px_18px_color-mix(in_srgb,var(--glow)_45%,transparent)] hover:opacity-95 transition-opacity"
        >
          Enter rooms
        </Link>
      ) : (
        <Link
          href="/auth/signup"
          className="px-5 py-2.5 rounded-[30px] border-none cursor-pointer font-[inherit] font-extrabold text-sm text-[#1a0d06] bg-[linear-gradient(120deg,var(--glow2),var(--glow))] shadow-[0_4px_18px_color-mix(in_srgb,var(--glow)_45%,transparent)] hover:opacity-95 transition-opacity"
        >
          Drop in free
        </Link>
      )}
    </header>
  );
}
