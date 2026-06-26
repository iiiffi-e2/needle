"use client";

import { EmailCapture } from "./EmailCapture";
import {
  HERO_BEAMS,
  HERO_CROWD,
  MARQUEE,
} from "./landing-data";

interface HeroVenueProps {
  liveCount: string;
  isLoggedIn?: boolean;
}

export function HeroVenue({ liveCount, isLoggedIn = false }: HeroVenueProps) {
  return (
    <section
      className="landing-hero relative w-full overflow-hidden flex flex-col"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 120%, #2a1709, var(--bg1) 62%), linear-gradient(180deg, #1a1008, #0a0503)",
      }}
    >
      <div
        className="landing-glow-pulse absolute top-[8%] left-1/2 -translate-x-1/2 w-[min(900px,100%)] h-[min(420px,50%)] blur-[20px] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--glow) 30%, transparent), transparent 62%)",
        }}
      />
      <div
        className="landing-glow-pulse absolute top-[14%] left-1/2 -translate-x-1/2 w-[min(520px,80%)] h-[min(280px,35%)] blur-[22px] pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--neon) 26%, transparent), transparent 60%)",
          animationDelay: "0.8s",
        }}
      />

      {HERO_BEAMS.map((b) => (
        <div
          key={b.x}
          className="landing-beam absolute -top-5 opacity-50 mix-blend-screen pointer-events-none hidden sm:block"
          style={{
            left: b.x,
            width: "200px",
            height: "min(480px, 55vh)",
            marginLeft: "-90px",
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--glow2) 34%, transparent), transparent 70%)",
            clipPath: "polygon(42% 0, 58% 0, 100% 100%, 0 100%)",
            transformOrigin: "top center",
            animation: `ndl-beam ${b.dur} ease-in-out infinite ${b.delay}`,
          }}
        />
      ))}

      {/* Copy block — flexes but stays compact */}
      <div className="landing-hero-copy relative z-30 flex flex-1 flex-col items-center justify-center text-center px-4 min-h-0">
        <div className="inline-flex items-center gap-2 px-[15px] py-[6px] rounded-[30px] mb-4 border border-[color-mix(in_srgb,var(--glow)_30%,transparent)] bg-[color-mix(in_srgb,var(--glow)_12%,transparent)]">
          <span className="landing-livedot w-[7px] h-[7px] rounded-full bg-[#36e07f] shadow-[0_0_8px_#36e07f]" />
          <span className="text-[12px] font-bold tracking-[0.04em] text-[var(--glow2)]">
            {liveCount} people on the floor right now
          </span>
        </div>

        <h1 className="landing-hero-title font-display font-extrabold leading-[0.95] tracking-[-0.03em] m-0 max-w-[880px] text-balance">
          Press play
          <br />
          with{" "}
          <span
            className="text-[var(--glow)]"
            style={{ textShadow: "0 0 40px color-mix(in srgb, var(--glow) 70%, transparent)" }}
          >
            strangers
          </span>
          .
        </h1>

        <p className="landing-hero-desc text-[var(--sub)] max-w-[500px] mt-4 text-pretty">
          Needle is a live music venue in your browser. Someone&apos;s always on deck, the crowd
          reacts in real time, and you&apos;re already on the floor.
        </p>

        <div className="mt-5 z-40 w-full flex flex-col items-center">
          <EmailCapture isLoggedIn={isLoggedIn} />
          <p className="text-[12px] text-[var(--sub)] mt-2.5 opacity-80">
            Free forever · pick a room in 10 seconds · keep it spinning
          </p>
        </div>
      </div>

      {/* Stage + ticker — fixed footprint at bottom */}
      <div className="landing-hero-stage-wrap relative z-20 shrink-0 w-full hidden sm:block">
        <div className="landing-hero-marquee mx-auto w-[560px] max-w-[90vw] rounded-md overflow-hidden bg-[#000a] border border-[color-mix(in_srgb,var(--glow)_30%,transparent)] shadow-[0_0_22px_color-mix(in_srgb,var(--glow)_30%,transparent)] flex items-center">
          <div
            className="landing-marquee-track whitespace-nowrap font-display font-bold text-[12px] tracking-[0.12em] text-[var(--glow2)] py-2 px-3"
            style={{ textShadow: "0 0 10px var(--glow)" }}
          >
            {MARQUEE}
            {MARQUEE}
          </div>
        </div>

        <div className="landing-hero-floor relative mt-6 h-[200px]">
          <div
            className="landing-hero-stage absolute bottom-0 left-1/2 -translate-x-1/2 w-[760px] max-w-[95vw] h-[170px] border-t-2 border-[color-mix(in_srgb,var(--glow)_50%,transparent)]"
            style={{
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--glow) 16%, var(--bg0)), var(--bg1))",
              clipPath: "polygon(18% 0, 82% 0, 100% 100%, 0% 100%)",
              boxShadow: "0 -4px 40px color-mix(in srgb, var(--glow) 25%, transparent)",
            }}
          />

          <div className="absolute bottom-[58px] left-1/2 -translate-x-1/2 flex flex-col items-center z-[8]">
            <div
              className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-[130px] h-[180px] opacity-60 mix-blend-screen"
              style={{
                background:
                  "linear-gradient(180deg, color-mix(in srgb, var(--glow2) 50%, transparent), transparent 70%)",
                clipPath: "polygon(40% 100%, 60% 100%, 100% 0, 0 0)",
              }}
            />
            <div className="landing-wobble relative">
              <div
                className="landing-glow-pulse absolute -inset-3 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, color-mix(in srgb, var(--glow) 55%, transparent), transparent 68%)",
                  animationDuration: "1.6s",
                }}
              />
              <div
                className="relative w-[58px] h-[62px] shadow-[0_10px_22px_#0008]"
                style={{
                  borderRadius: "48% 48% 44% 44% / 56% 56% 44% 44%",
                  background:
                    "radial-gradient(circle at 40% 28%, #ffffff88, #fff0 46%), linear-gradient(165deg, #ff9b6b, #e8552f)",
                }}
              >
                <div className="absolute -top-[5px] left-1/2 -translate-x-1/2 w-[54px] h-7 border-[5px] border-[#1d1d24] border-b-0 rounded-t-[32px]" />
                <div className="absolute top-[16px] -left-1.5 w-3 h-5 rounded-[5px] bg-[#1d1d24]" />
                <div className="absolute top-[16px] -right-1.5 w-3 h-5 rounded-[5px] bg-[#1d1d24]" />
                <span className="absolute top-[26px] left-1/2 -translate-x-1/2 flex gap-2.5">
                  <span className="w-1.5 h-2 rounded-full bg-[#231a16]" />
                  <span className="w-1.5 h-2 rounded-full bg-[#231a16]" />
                </span>
              </div>
            </div>
            <span className="mt-1.5 px-2.5 py-[3px] rounded-[20px] bg-[linear-gradient(120deg,var(--glow),var(--accent))] text-[#1a0d06] text-[9.5px] font-extrabold tracking-[0.08em]">
              vinyl_vera · ON DECK
            </span>
          </div>

          {HERO_CROWD.map((a, i) => (
            <div key={i} style={a.wrap}>
              {a.react && (
                <span
                  className="absolute -top-[22px] left-1/2 -translate-x-1/2 text-lg"
                  style={{
                    color: a.color,
                    textShadow: `0 0 12px ${a.color}`,
                    animation: `ndl-rise ${a.rdur} ease-out infinite ${a.rdelay}`,
                  }}
                >
                  {a.glyph}
                </span>
              )}
              <div style={a.body} />
            </div>
          ))}
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 w-full h-16 z-[25] pointer-events-none"
        style={{ background: "linear-gradient(180deg, transparent, var(--bg1))" }}
      />
    </section>
  );
}
