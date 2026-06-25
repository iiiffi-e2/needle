"use client";

import type { DjSlot, RoomMember, User } from "@/lib/types";
import { VinylBlob } from "@/components/avatars/VinylBlob";
import {
  assignCrowdLayout,
  crowdColorForUser,
} from "@/lib/design-tokens";
import { getInitials } from "@/lib/utils";

const RIG_LIGHTS = [
  { x: 12.77, dur: "5s", delay: "0s" },
  { x: 31.91, dur: "6.2s", delay: "0.6s" },
  { x: 50, dur: "4.4s", delay: "0.2s" },
  { x: 68.09, dur: "5.6s", delay: "0.9s" },
  { x: 86.17, dur: "6.8s", delay: "0.4s" },
];

const SPEAKER_LEFT = [5.11, 86.06];

interface DeckSlotProps {
  side: "left" | "right";
  occupant: DjSlot | null;
  isCurrentUser: boolean;
  onJoin: () => void;
  onLeave: () => void;
  loading: boolean;
  canJoin: boolean;
}

function DeckSlot({
  side,
  occupant,
  isCurrentUser,
  onJoin,
  onLeave,
  loading,
  canJoin,
}: DeckSlotProps) {
  const isLeft = side === "left";
  const accentRgb = isLeft ? "255, 157, 60" : "123, 92, 255";
  const accentHex = isLeft ? "var(--glow)" : "var(--neon)";
  const accentLight = isLeft ? "var(--glow2)" : "var(--neon)";

  if (occupant?.user) {
    return (
      <div className="flex flex-col items-center pointer-events-auto">
        <VinylBlob
          variant={isCurrentUser ? "you" : "crowd"}
          color={crowdColorForUser(occupant.user_id)}
          size={60}
          dance
          showRing
          initials={
            isCurrentUser ? getInitials(occupant.user.display_name) : undefined
          }
        />
        <div className="mt-2 text-center">
          <div className="font-extrabold text-xs">
            {isCurrentUser ? "you" : occupant.user.display_name}
          </div>
          {isCurrentUser && (
            <button
              type="button"
              onClick={onLeave}
              disabled={loading}
              className="mt-1 px-2.5 py-0.5 rounded-full border font-bold text-[9.5px] cursor-pointer disabled:opacity-50"
              style={{
                borderColor: "var(--line)",
                background: "#ffffff10",
                color: "var(--sub)",
              }}
            >
              Step off
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center pointer-events-auto">
      <button
        type="button"
        onClick={canJoin ? onJoin : undefined}
        disabled={loading || !canJoin}
        className="relative w-[74px] h-[74px] rounded-full border-2 border-dashed flex items-center justify-center disabled:opacity-60"
        style={{
          borderColor: `rgba(${accentRgb}, 0.55)`,
          background: `radial-gradient(circle, rgba(${accentRgb}, 0.14), transparent 70%)`,
          cursor: canJoin ? "pointer" : "default",
        }}
      >
        {canJoin && (
          <span
            className="absolute inset-[-2px] rounded-full border-2 pointer-events-none"
            style={{
              borderColor: `rgba(${accentRgb}, 0.5)`,
              animation: "ndl-pulsering 2.4s ease-out infinite",
              animationDelay: isLeft ? "0s" : "1.1s",
            }}
          />
        )}
        <span
          className="text-2xl font-light leading-none"
          style={{ color: accentLight }}
        >
          +
        </span>
      </button>
      <button
        type="button"
        onClick={canJoin ? onJoin : undefined}
        disabled={loading || !canJoin}
        className="text-[10px] font-bold tracking-[0.05em] mt-1.5 disabled:opacity-60"
        style={{
          color: "var(--sub)",
          cursor: canJoin ? "pointer" : "default",
        }}
      >
        JOIN DECK
      </button>
    </div>
  );
}

export interface VenueCanvasProps {
  currentDj: User | null;
  isDjSleeping?: boolean;
  sideDjs: [DjSlot | null, DjSlot | null];
  members: RoomMember[];
  djUserIds: Set<string>;
  currentUserId: string | null;
  energy: number;
  marquee: string;
  canJoinDeck: boolean;
  onJoinDeck: () => void;
  onLeaveDeck: () => void;
  deckLoading: boolean;
}

export function VenueCanvas({
  currentDj,
  isDjSleeping = false,
  sideDjs,
  members,
  djUserIds,
  currentUserId,
  energy,
  marquee,
  canJoinDeck,
  onJoinDeck,
  onLeaveDeck,
  deckLoading,
}: VenueCanvasProps) {
  const glowOpacity = 0.32 + (energy / 100) * 0.6;
  const neonGlowOpacity = 0.25 + (energy / 100) * 0.55;
  const beamOpacity = 0.4 + (energy / 100) * 0.45;
  const thumpDur = `${(1.4 - (energy / 100) * 0.8).toFixed(2)}s`;
  const djWobble = `${(2.0 - (energy / 100) * 0.7).toFixed(2)}s`;
  const deckSpinA = `${(2.2 - (energy / 100) * 1.0).toFixed(2)}s`;
  const deckSpinB = `${(2.7 - (energy / 100) * 1.2).toFixed(2)}s`;

  const eqBars = Array.from({ length: 5 }, (_, i) => ({
    d: `${(0.5 + i * 0.12).toFixed(2)}s`,
    delay: `${(i * 0.13).toFixed(2)}s`,
  }));

  const listeners = members
    .filter((m) => !djUserIds.has(m.user_id))
    .sort(
      (a, b) =>
        new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
    );

  const crowd = assignCrowdLayout(
    listeners.map((m) => m.user_id),
    energy
  );

  return (
    <div className="needle-venue-inner">
      {/* Back wall glow */}
      <div
        className="absolute transition-opacity duration-700 pointer-events-none"
        style={{
          top: "-5.6%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "80.9%",
          height: "58.7%",
          background:
            "radial-gradient(circle at 50% 30%, rgba(255, 157, 60, 0.4), transparent 62%)",
          filter: "blur(8px)",
          opacity: glowOpacity,
        }}
      />
      <div
        className="absolute transition-opacity duration-700 pointer-events-none"
        style={{
          top: "2.8%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "44.7%",
          height: "36.3%",
          background:
            "radial-gradient(circle at 50% 40%, rgba(123, 92, 255, 0.3), transparent 60%)",
          filter: "blur(10px)",
          opacity: neonGlowOpacity,
        }}
      />

      {/* Light rig */}
      <div
        className="absolute top-0 left-0 right-0 z-[6] pointer-events-none"
        style={{
          height: 18,
          background: "linear-gradient(180deg, #0a0a0f, #000)",
          borderBottom: "2px solid #000",
          boxShadow: "0 3px 10px rgba(0,0,0,0.67)",
        }}
      />
      {RIG_LIGHTS.map((L, i) => (
        <div
          key={i}
          className="absolute z-[5] pointer-events-none"
          style={{ top: 14, left: `${L.x}%` }}
        >
          <div
            className="mx-auto"
            style={{
              width: 14,
              height: 10,
              borderRadius: "3px 3px 5px 5px",
              background: "linear-gradient(180deg, #1b1b22, #0a0a0e)",
              boxShadow: "inset 0 -2px 3px var(--lampc)",
            }}
          />
          <div className="w-0.5 h-2 bg-[#222] mx-auto" />
          <div
            className="mix-blend-screen transition-opacity duration-700"
            style={{
              width: 120,
              height: 240,
              marginLeft: -53,
              background:
                "linear-gradient(180deg, rgba(255, 184, 96, 0.6), transparent 72%)",
              clipPath: "polygon(42% 0, 58% 0, 100% 100%, 0 100%)",
              transformOrigin: "top center",
              animation: `ndl-beam ${L.dur} ease-in-out infinite ${L.delay}`,
              opacity: beamOpacity,
            }}
          />
        </div>
      ))}

      {/* Marquee */}
      <div
        className="absolute z-[8] overflow-hidden flex items-center pointer-events-none"
        style={{
          top: "4.2%",
          left: "18.1%",
          width: "63.8%",
          height: 26,
          borderRadius: 6,
          background: "linear-gradient(180deg, rgba(0,0,0,0.67), rgba(0,0,0,0.4))",
          border: "1px solid rgba(255, 157, 60, 0.3)",
          boxShadow:
            "0 0 22px rgba(255, 157, 60, 0.35), inset 0 0 18px rgba(0,0,0,0.5)",
        }}
      >
        <div
          className="whitespace-nowrap font-display font-bold tracking-[0.12em]"
          style={{
            fontSize: 13,
            color: "var(--glow2)",
            textShadow: "0 0 10px var(--glow)",
            animation: "ndl-marquee 16s linear infinite",
          }}
        >
          {marquee}
          {marquee}
        </div>
      </div>

      {/* Stage */}
      <div
        className="absolute z-[7] pointer-events-none"
        style={{
          top: "20.9%",
          left: "13.8%",
          width: "72.3%",
          height: "25.1%",
          background:
            "linear-gradient(180deg, rgba(255, 157, 60, 0.14), var(--bg0)), var(--bg1)",
          clipPath: "polygon(16% 0, 84% 0, 100% 100%, 0% 100%)",
          borderTop: "2px solid rgba(255, 157, 60, 0.5)",
          boxShadow: "0 -2px 30px rgba(255, 157, 60, 0.3)",
        }}
      />
      <div
        className="absolute z-[8] pointer-events-none"
        style={{
          top: "20.7%",
          left: "13.8%",
          width: "72.3%",
          height: 4,
          background: "var(--glow2)",
          filter: "blur(2px)",
          clipPath: "polygon(16% 0, 84% 0, 84% 100%, 16% 100%)",
          boxShadow: "0 0 16px var(--glow)",
        }}
      />

      {/* Speakers */}
      {SPEAKER_LEFT.map((leftPct, si) => (
        <div
          key={leftPct}
          className="absolute z-[9] flex flex-col items-center pointer-events-none"
          style={{
            top: "20.9%",
            left: `${leftPct}%`,
            width: 74,
            height: 172,
            borderRadius: 8,
            background: "linear-gradient(180deg, #16161c, #08080c)",
            border: "1px solid #000",
            boxShadow: "0 10px 30px rgba(0,0,0,0.67), inset 0 1px 0 rgba(255,255,255,0.08)",
            padding: "10px 0",
            gap: 9,
          }}
        >
          <div
            className="rounded-full shrink-0"
            style={{
              width: 48,
              height: 48,
              background:
                "radial-gradient(circle at 50% 42%, #2a2a33 0 40%, #0c0c10 41% 70%, rgba(255, 157, 60, 0.6) 71%)",
              boxShadow:
                "inset 0 0 12px #000, 0 0 14px rgba(255, 157, 60, 0.35)",
              animation: `ndl-glow ${thumpDur} ease-in-out infinite`,
            }}
          />
          <div
            className="rounded-full shrink-0"
            style={{
              width: 30,
              height: 30,
              background:
                "radial-gradient(circle at 50% 42%, #232329 0 45%, #0a0a0e 46%)",
              boxShadow: "inset 0 0 8px #000",
            }}
          />
          <div className="flex items-end gap-[3px] h-5 mt-0.5">
            {eqBars.map((e, i) => (
              <span
                key={i}
                className="w-1 origin-bottom rounded-sm"
                style={{
                  height: 18,
                  background: "linear-gradient(180deg, var(--glow2), var(--glow))",
                  animation: `ndl-eq ${e.d} ease-in-out infinite ${e.delay}`,
                }}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Left deck */}
      <div
        className="absolute z-[11]"
        style={{ top: "27.4%", left: "31.9%", transform: "translateX(-50%)" }}
      >
        <DeckSlot
          side="left"
          occupant={sideDjs[0]}
          isCurrentUser={sideDjs[0]?.user_id === currentUserId}
          onJoin={onJoinDeck}
          onLeave={onLeaveDeck}
          loading={deckLoading}
          canJoin={canJoinDeck}
        />
      </div>

      {/* Center DJ */}
      <div
        className="absolute z-[14] flex flex-col items-center pointer-events-none"
        style={{
          top: "16.8%",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      >
        <div
          className="absolute pointer-events-none"
          style={{
            top: -26,
            width: 150,
            height: 230,
            background:
              "linear-gradient(180deg, rgba(255, 208, 137, 0.55), transparent 70%)",
            clipPath: "polygon(40% 0, 60% 0, 100% 100%, 0 100%)",
            mixBlendMode: "screen",
            opacity: 0.75,
          }}
        />
        {currentDj ? (
          <>
            <div
              className="relative"
              style={
                isDjSleeping
                  ? undefined
                  : { animation: `ndl-wobble ${djWobble} ease-in-out infinite` }
              }
            >
              {isDjSleeping && (
                <span
                  className="absolute left-1/2 -translate-x-1/2 pointer-events-none font-extrabold tracking-widest select-none"
                  style={{
                    top: -22,
                    fontSize: 14,
                    color: "var(--sub)",
                    animation: "ndl-sleep 2.4s ease-in-out infinite",
                  }}
                >
                  zzzzz
                </span>
              )}
              <VinylBlob
                variant="dj"
                size={66}
                dance={!isDjSleeping}
                showRing
              />
            </div>
            <div className="mt-2 text-center pointer-events-auto">
              <div
                className="font-display font-extrabold"
                style={{ fontSize: 13 }}
              >
                {currentDj.display_name}
              </div>
              <div
                className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full font-extrabold tracking-[0.08em]"
                style={{
                  fontSize: 9.5,
                  color: isDjSleeping ? "var(--sub)" : "#1a0d06",
                  background: isDjSleeping
                    ? "rgba(255,255,255,0.08)"
                    : "linear-gradient(120deg, var(--glow), var(--accent))",
                  boxShadow: isDjSleeping
                    ? "none"
                    : "0 0 16px rgba(255, 157, 60, 0.6)",
                }}
              >
                {isDjSleeping ? "RESTING" : "ON DECK"}
              </div>
            </div>
          </>
        ) : (
          <div className="text-sm italic mt-8" style={{ color: "var(--sub)" }}>
            Booth open
          </div>
        )}
      </div>

      {/* Right deck */}
      <div
        className="absolute z-[11]"
        style={{ top: "27.4%", left: "58.3%", transform: "translateX(-50%)" }}
      >
        <DeckSlot
          side="right"
          occupant={sideDjs[1]}
          isCurrentUser={sideDjs[1]?.user_id === currentUserId}
          onJoin={onJoinDeck}
          onLeave={onLeaveDeck}
          loading={deckLoading}
          canJoin={canJoinDeck}
        />
      </div>

      {/* Turntable booth */}
      <div
        className="absolute z-[13] flex justify-center pointer-events-none"
        style={{
          top: "36.6%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 204,
          height: 64,
          gap: 22,
          paddingTop: 12,
          background: "linear-gradient(180deg, #1a1a21, #0b0b0f)",
          clipPath: "polygon(8% 0, 92% 0, 100% 100%, 0 100%)",
          borderTop: "1px solid rgba(255, 157, 60, 0.4)",
          boxShadow:
            "0 -1px 18px rgba(255, 157, 60, 0.28), 0 12px 26px rgba(0,0,0,0.67)",
        }}
      >
        {[deckSpinA, deckSpinB].map((spin, i) => (
          <div
            key={i}
            className="rounded-full relative"
            style={{
              width: 40,
              height: 40,
              background:
                "radial-gradient(circle at 50% 50%, #050507 0 16%, #1a1a20 17% 78%, #2a2a32 79%)",
              boxShadow: `inset 0 0 8px #000, 0 0 10px rgba(${i === 0 ? "255, 157, 60" : "123, 92, 255"}, 0.3)`,
              animation: `ndl-spin ${spin} linear infinite`,
            }}
          >
            <span
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                width: 8,
                height: 8,
                background: i === 0 ? "var(--glow)" : "var(--neon)",
              }}
            />
          </div>
        ))}
      </div>

      {/* Crowd floor */}
      <div
        className="absolute z-[10] pointer-events-none"
        style={{ top: "41.9%", left: 0, right: 0, bottom: 0 }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, transparent, var(--floor0) 40%, var(--floor1))",
          }}
        />
        <div
          className="absolute inset-0 opacity-50"
          style={{
            background:
              "repeating-linear-gradient(180deg, transparent 0 38px, rgba(255, 157, 60, 0.07) 38px 39px)",
            maskImage: "linear-gradient(180deg, transparent, #000 60%)",
          }}
        />
      </div>

      {/* Crowd avatars */}
      {crowd.map((c, i) => {
        const member = listeners.find((m) => m.user_id === c.userId);
        if (!member) return null;
        return (
          <div
            key={member.id}
            className="absolute pointer-events-none"
            style={{
              left: `${c.leftPct}%`,
              top: `${c.topPct}%`,
              width: c.size,
              transform: "translateX(-50%)",
              zIndex: c.zIndex,
            }}
          >
            <VinylBlob
              color={crowdColorForUser(c.userId)}
              size={c.size}
              dance={c.dance}
              showRing={c.dance}
              showReact={c.showReact}
              reactGlyph={c.reactGlyph}
              reactColor={c.reactColor}
              reactDelay={i * 0.45}
              animDuration={c.animDuration}
            />
          </div>
        );
      })}
    </div>
  );
}
