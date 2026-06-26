"use client";

import Link from "next/link";
import { EmailCapture } from "./EmailCapture";
import { FLOAT_BLOBS } from "./landing-data";

interface FooterCtaProps {
  isLoggedIn?: boolean;
}

export function FooterCta({ isLoggedIn = false }: FooterCtaProps) {
  return (
    <section
      className="relative w-full px-4 sm:px-8 lg:px-14 pt-20 sm:pt-28 pb-12 lg:pb-[70px] overflow-hidden"
      style={{
        background: "radial-gradient(110% 90% at 50% 120%, #3a1f0c, var(--bg1) 60%)",
      }}
    >
      <div
        className="landing-glow-pulse absolute top-10 left-1/2 -translate-x-1/2 w-[min(800px,100%)] h-[400px] blur-[24px] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--glow) 26%, transparent), transparent 62%)",
        }}
      />

      {FLOAT_BLOBS.map((a, i) => (
        <div key={i} style={a.wrapFoot} className="pointer-events-none hidden lg:block">
          <div style={a.body} />
        </div>
      ))}

      <div className="relative text-center z-10">
        <h2 className="landing-footer-title font-display font-extrabold text-[64px] tracking-[-0.03em] m-0 leading-[0.98]">
          Your room is
          <br />
          one click away.
        </h2>
        <div className="mt-[34px] flex justify-center">
          <EmailCapture
            isLoggedIn={isLoggedIn}
            successMessage="You're in. See you on the floor."
          />
        </div>
        <p className="text-[13px] text-[var(--sub)] mt-4 opacity-85">
          Free forever · no app · keep it weird
        </p>
      </div>

      <footer className="relative z-10 mt-16 lg:mt-[90px] pt-7 border-t border-[var(--line)] flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-2">
          <div
            className="w-[26px] h-[26px] rounded-full"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, var(--bg1) 0 22%, var(--glow) 23% 30%, var(--bg1) 31% 46%, var(--glow2) 47% 52%, var(--bg1) 53%)",
            }}
          />
          <span className="font-display font-extrabold text-[17px]">Needle</span>
        </div>
        <span className="text-[12.5px] text-[var(--sub)] sm:ml-1.5">
          © {new Date().getFullYear()} · keep it spinning
        </span>
        <div className="flex-1" />
        <div className="flex flex-wrap gap-5 sm:gap-[26px] text-[13px] text-[var(--sub)]">
          <Link href="/rooms" className="hover:text-[var(--txt)] transition-colors">
            Rooms
          </Link>
          <Link href="/auth/signup" className="hover:text-[var(--txt)] transition-colors">
            About
          </Link>
          <span className="cursor-default opacity-60">Discord</span>
          <span className="cursor-default opacity-60">Privacy</span>
        </div>
      </footer>
    </section>
  );
}
