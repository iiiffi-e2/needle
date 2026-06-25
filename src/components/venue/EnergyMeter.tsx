"use client";

import { energyBarHeights, energyLabel } from "@/lib/room-energy";

interface EnergyMeterProps {
  energy: number;
}

export function EnergyMeter({ energy }: EnergyMeterProps) {
  const lit = Math.round((energy / 100) * 7);
  const bars = energyBarHeights();

  return (
    <div
      className="flex items-center gap-2.5 shrink-0"
      style={{
        padding: "6px 13px",
        borderRadius: 30,
        background: "rgba(28, 18, 11, 0.7)",
        border: "1px solid var(--line)",
      }}
    >
      <span
        className="uppercase font-semibold"
        style={{
          fontSize: 10.5,
          letterSpacing: "0.1em",
          color: "var(--sub)",
        }}
      >
        Energy
      </span>
      <div className="flex items-end gap-[3px] h-[18px]">
        {bars.map((h, i) => (
          <span
            key={i}
            className="w-1 rounded-sm transition-all duration-400"
            style={{
              height: h,
              background:
                i < lit
                  ? i >= 5
                    ? "var(--accent)"
                    : "var(--glow)"
                  : "#ffffff22",
              boxShadow: i < lit ? "0 0 6px var(--glow)" : "none",
            }}
          />
        ))}
      </div>
      <span
        className="font-bold min-w-[74px]"
        style={{ fontSize: 12, color: "var(--glow2)" }}
      >
        {energyLabel(energy)}
      </span>
    </div>
  );
}
