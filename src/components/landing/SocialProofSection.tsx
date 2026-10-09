import { formatListenerCount } from "@/lib/landing-honesty";

interface SocialProofSectionProps {
  spinningCount: number;
  listenerTotal: number;
}

export function SocialProofSection({
  spinningCount,
  listenerTotal,
}: SocialProofSectionProps) {
  const figures = [
    { value: formatListenerCount(listenerTotal), label: "on the floor" },
    { value: formatListenerCount(spinningCount), label: "rooms spinning" },
  ];

  return (
    <section id="vibe" className="relative w-full px-4 sm:px-8 lg:px-14 py-16 sm:py-24 lg:py-24 bg-[var(--bg1)]">
      <div className="text-center mb-10">
        <h2 className="landing-section-title font-display font-extrabold text-[46px] tracking-[-0.025em] m-0 leading-none">
          Right now.
        </h2>
      </div>

      <div className="landing-stats-row flex justify-center gap-0">
        {figures.map((s) => (
          <div
            key={s.label}
            className="px-8 lg:px-14 text-center border-r border-[var(--line)] last:border-r-0"
          >
            <div className="font-display font-extrabold text-[44px] text-[var(--glow)] tracking-[-0.02em]">
              {s.value}
            </div>
            <div className="text-[13px] text-[var(--sub)] mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {spinningCount === 0 && listenerTotal === 0 ? (
        <p className="text-center text-[var(--sub)] mt-8">
          No rooms spinning yet. The numbers show up when someone is actually here.
        </p>
      ) : null}
    </section>
  );
}
