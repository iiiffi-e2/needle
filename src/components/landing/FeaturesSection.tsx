import { FEATURES } from "./landing-data";

export function FeaturesSection() {
  return (
    <section
      id="features"
      className="relative w-full px-4 sm:px-8 lg:px-14 py-16 sm:py-24 lg:py-24"
      style={{
        background: "radial-gradient(120% 60% at 50% 0%, #1a1008, var(--bg1) 60%)",
      }}
    >
      <div className="text-center mb-12 lg:mb-14">
        <span className="text-[13px] font-bold tracking-[0.1em] text-[var(--glow2)] uppercase">
          It&apos;s not a playlist
        </span>
        <h2 className="font-display font-extrabold text-[52px] tracking-[-0.025em] mt-3 m-0 leading-none">
          It&apos;s a place.
        </h2>
      </div>

      <div className="landing-features-grid grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-[1000px] mx-auto">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="relative rounded-[20px] px-7 py-[30px] border border-[var(--line)] overflow-hidden min-h-[200px]"
            style={{ background: "linear-gradient(180deg, #1c120b, #120b07)" }}
          >
            <div
              className="absolute -top-[30px] -right-5 w-40 h-40 blur-[10px] opacity-50 pointer-events-none"
              style={{ background: `radial-gradient(circle, ${f.glow}, transparent 66%)` }}
            />
            <div
              className="relative w-[54px] h-[54px] rounded-[14px] flex items-center justify-center text-[26px] mb-[18px] border"
              style={{
                background: `color-mix(in srgb, ${f.glow} 16%, transparent)`,
                borderColor: `color-mix(in srgb, ${f.glow} 35%, transparent)`,
              }}
            >
              {f.icon}
            </div>
            <div className="relative font-display font-bold text-[22px] mb-2">{f.title}</div>
            <div className="relative text-[14.5px] leading-[1.55] text-[var(--sub)] max-w-[380px]">
              {f.body}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
