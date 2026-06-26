"use client";

import { EmailCapture } from "./EmailCapture";
import { FLOAT_BLOBS } from "./landing-data";

interface HeroStatementProps {
  liveCount: string;
  isLoggedIn?: boolean;
}

export function HeroStatement({ liveCount, isLoggedIn = false }: HeroStatementProps) {
  return (
    <section
      className="landing-hero landing-hero-statement relative w-full overflow-hidden"
      style={{
        background:
          "radial-gradient(100% 80% at 80% 10%, #2a1709, transparent 55%), radial-gradient(80% 70% at 15% 90%, #1c1033, transparent 55%), var(--bg1)",
      }}
    >
      <div
        className="landing-glow-pulse absolute -top-[60px] -right-10 w-[min(620px,70vw)] h-[min(620px,70vw)] blur-[20px] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--glow) 26%, transparent), transparent 62%)",
          animationDuration: "7s",
        }}
      />
      <div
        className="landing-glow-pulse absolute -bottom-20 -left-[60px] w-[min(560px,65vw)] h-[min(560px,65vw)] blur-[22px] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--neon) 24%, transparent), transparent 62%)",
          animationDuration: "5.5s",
          animationDelay: "1s",
        }}
      />

      {FLOAT_BLOBS.map((a, i) => (
        <div key={i} style={a.wrap} className="pointer-events-none hidden sm:block">
          <div style={a.body} />
        </div>
      ))}

      <div className="landing-hero-statement-inner relative z-20 flex h-full min-h-0 flex-col lg:flex-row lg:items-center">
        <div className="landing-hero-statement-copy flex flex-1 flex-col justify-center px-4 sm:px-8 lg:pl-16 lg:pr-8 xl:pl-24 py-8 lg:py-0 min-h-0">
          <div className="inline-flex w-fit items-center gap-2 px-[15px] py-[6px] rounded-[30px] mb-5 lg:mb-[26px] border border-[color-mix(in_srgb,var(--glow)_30%,transparent)] bg-[color-mix(in_srgb,var(--glow)_12%,transparent)]">
            <span className="landing-livedot w-[7px] h-[7px] rounded-full bg-[#36e07f] shadow-[0_0_8px_#36e07f]" />
            <span className="text-[12px] font-bold tracking-[0.04em] text-[var(--glow2)]">
              {liveCount} on the floor right now
            </span>
          </div>

          <h1 className="landing-hero-statement-title font-display font-extrabold leading-[0.9] tracking-[-0.04em] m-0 text-left">
            Press play
            <br />
            with
            <br />
            <span
              className="text-[var(--glow)]"
              style={{ textShadow: "0 0 50px color-mix(in srgb, var(--glow) 70%, transparent)" }}
            >
              strangers.
            </span>
          </h1>

          <p className="landing-hero-desc text-[var(--sub)] max-w-[440px] mt-6 lg:mt-7 text-left text-pretty">
            Needle is a live music venue in your browser. DJs spin, the crowd reacts, and the
            room is always on. Keep it weird. Keep it spinning.
          </p>

          <div className="mt-6 lg:mt-8">
            <EmailCapture compact isLoggedIn={isLoggedIn} />
            <p className="text-[13px] text-[var(--sub)] mt-3.5 opacity-80 text-left">
              Free forever · pick a room in 10 seconds
            </p>
          </div>
        </div>

        <div className="landing-hero-turntable-wrap relative z-[5] flex shrink-0 items-center justify-center px-4 pb-8 lg:pb-0 lg:pr-16 xl:pr-[90px]">
          <div className="landing-hero-turntable relative w-[min(380px,72vw)] aspect-square">
            <div
              className="absolute inset-0 rounded-full animate-ndl-spin"
              style={{
                animationDuration: "8s",
                background:
                  "radial-gradient(circle at 50% 50%, #100a06 0 18%, #1c1209 19% 92%, #2a1a0d 93%)",
                boxShadow: "0 30px 80px #000a, inset 0 0 60px #000",
              }}
            />
            <div
              className="absolute inset-0 rounded-full animate-ndl-spin pointer-events-none"
              style={{
                animationDuration: "8s",
                background:
                  "repeating-radial-gradient(circle at 50% 50%, transparent 0 3px, #00000040 3px 4px)",
              }}
            />
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[31.5%] aspect-square rounded-full z-[2]"
              style={{
                background:
                  "radial-gradient(circle at 40% 35%, var(--glow2), var(--glow) 55%, var(--accent))",
                boxShadow: "0 0 40px color-mix(in srgb, var(--glow) 60%, transparent)",
              }}
            />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[3.7%] aspect-square rounded-full bg-[#100a06] z-[3]" />

            <div
              className="landing-hero-tonearm absolute -top-[30px] -right-[30px] w-[52.6%] h-[18px] origin-right"
              style={{ animation: "ndl-needle 3s ease-in-out infinite alternate" }}
            >
              <div className="absolute right-0 -top-1.5 w-[30px] h-[30px] rounded-full bg-[#2a2a32] shadow-[0_4px_10px_#0008]" />
              <div className="absolute right-[18px] top-1 w-[calc(100%-18px)] h-2 rounded-md bg-[linear-gradient(90deg,#3a3a44,#1d1d24)]" />
              <div className="absolute left-0 top-0 w-[18px] h-[22px] rounded-[3px] bg-[var(--glow)] shadow-[0_0_14px_var(--glow)]" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
