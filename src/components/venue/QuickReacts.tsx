"use client";

export interface ReactionBurst {
  id: string;
  glyph: string;
  color: string;
  left: string;
  size: string;
}

interface QuickReactsProps {
  roomSlug: string;
  onBurst: (glyph: string, color: string, count?: number) => void;
}

const REACTS = [
  { glyph: "♥", color: "#ff6fae", type: "heart" },
  { glyph: "★", color: "#ffd166", type: "star" },
  { glyph: "♪", color: "#5ad1c8", type: "note" },
  { glyph: "▲", color: "#ff8a3d", type: "fire" },
] as const;

export function QuickReacts({ roomSlug, onBurst }: QuickReactsProps) {
  const handleReact = async (glyph: string, color: string, type: string) => {
    onBurst(glyph, color, type === "fire" ? 1 : 1);
    fetch(`/api/rooms/${roomSlug}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    }).catch(() => {});
  };

  return (
    <div
      className="absolute z-30 flex flex-col pointer-events-auto"
      style={{ right: 18, bottom: 150, gap: 9 }}
    >
      {REACTS.map((q) => (
        <button
          key={q.type}
          type="button"
          title="React"
          onClick={() => handleReact(q.glyph, q.color, q.type)}
          className="w-[42px] h-[42px] rounded-full border flex items-center justify-center text-lg cursor-pointer"
          style={{
            borderColor: "var(--line)",
            background: "rgba(34, 21, 13, 0.7)",
            backdropFilter: "blur(8px)",
            color: q.color,
            boxShadow: "0 6px 16px rgba(0,0,0,0.5)",
          }}
        >
          {q.glyph}
        </button>
      ))}
    </div>
  );
}

export function ReactionBursts({ bursts }: { bursts: ReactionBurst[] }) {
  return (
    <>
      {bursts.map((b) => (
        <span
          key={b.id}
          className="absolute pointer-events-none z-[28] leading-none"
          style={{
            left: b.left,
            bottom: "120px",
            fontSize: b.size,
            color: b.color,
            textShadow: `0 0 16px ${b.color}`,
            animation: "ndl-rise 1.6s ease-out forwards",
          }}
        >
          {b.glyph}
        </span>
      ))}
    </>
  );
}
