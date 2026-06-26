import { QUOTES, STATS } from "./landing-data";

export function SocialProofSection() {
  return (
    <section id="vibe" className="relative w-full px-4 sm:px-8 lg:px-14 py-16 sm:py-24 lg:py-24 bg-[var(--bg1)]">
      <div className="landing-stats-row flex justify-center gap-0 mb-12 lg:mb-16">
        {STATS.map((s) => (
          <div
            key={s.label}
            className="px-8 lg:px-14 text-center border-r border-[var(--line)] last:border-r-0"
          >
            <div className="font-display font-extrabold text-[44px] text-[var(--glow)] tracking-[-0.02em]">
              {s.n}
            </div>
            <div className="text-[13px] text-[var(--sub)] mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="text-center mb-10">
        <h2 className="landing-section-title font-display font-extrabold text-[46px] tracking-[-0.025em] m-0 leading-none">
          People are losing it.
          <br />
          <span className="text-[var(--sub)] text-[30px] font-medium">(affectionately)</span>
        </h2>
      </div>

      <div className="landing-quotes-grid grid grid-cols-1 md:grid-cols-3 gap-[18px] max-w-[1080px] mx-auto">
        {QUOTES.map((q) => (
          <div
            key={q.handle}
            className="rounded-[18px] px-6 py-[26px] border border-[var(--line)]"
            style={{ background: "linear-gradient(180deg, #1c120b, #120b07)" }}
          >
            <div className="text-base leading-normal text-[var(--txt)] mb-5 text-pretty">
              &ldquo;{q.text}&rdquo;
            </div>
            <div className="flex items-center gap-[11px]">
              <div
                className="relative w-[38px] h-10 shrink-0"
                style={{
                  borderRadius: "48% 48% 44% 44% / 56% 56% 44% 44%",
                  background: `radial-gradient(circle at 40% 28%, #ffffff88, #fff0 46%), ${q.color}`,
                }}
              >
                <span className="absolute top-[38%] left-1/2 -translate-x-1/2 flex gap-[5px]">
                  <span className="w-1 h-[5px] rounded-full bg-[#1c1414]" />
                  <span className="w-1 h-[5px] rounded-full bg-[#1c1414]" />
                </span>
              </div>
              <div>
                <div className="text-[13px] font-bold">{q.name}</div>
                <div className="text-[11.5px] text-[var(--sub)]">{q.handle}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
