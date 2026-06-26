"use client";

import Link from "next/link";
import { LANDING_ROOMS } from "./landing-data";
import type { RoomWithStats } from "@/lib/types";

interface LiveRoomsSectionProps {
  rooms?: RoomWithStats[];
}

function mergeRooms(apiRooms: RoomWithStats[] | undefined) {
  if (!apiRooms?.length) return LANDING_ROOMS;

  return apiRooms.slice(0, 4).map((room, i) => {
    const fallback = LANDING_ROOMS[i % LANDING_ROOMS.length];
    const track = room.current_track;
    const trackLabel = track
      ? `${track.title}${track.artist ? ` — ${track.artist}` : ""}`
      : fallback.track;
    const tag = room.tags?.[0] || fallback.tag;
    return {
      slug: room.slug,
      name: room.name,
      track: trackLabel,
      count: String(room.listener_count ?? fallback.count),
      tag,
      bg: fallback.bg,
      glow: fallback.glow,
      stage: fallback.stage,
      dj: fallback.dj,
      blobs: fallback.blobs,
    };
  });
}

export function LiveRoomsSection({ rooms }: LiveRoomsSectionProps) {
  const displayRooms = mergeRooms(rooms);

  return (
    <section id="rooms" className="relative w-full px-4 sm:px-8 lg:px-14 py-16 sm:py-24 lg:py-[100px] bg-[var(--bg1)]">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="landing-livedot w-2 h-2 rounded-full bg-[#36e07f] shadow-[0_0_10px_#36e07f]" />
            <span className="text-[13px] font-bold tracking-[0.1em] text-[var(--glow2)] uppercase">
              Spinning right now
            </span>
          </div>
          <h2 className="landing-section-title font-display font-extrabold text-[46px] tracking-[-0.025em] m-0 leading-none">
            Pick a room. Any room.
          </h2>
        </div>
        <Link
          href="/rooms"
          className="text-[15px] font-bold text-[var(--glow2)] hover:underline whitespace-nowrap"
        >
          Browse all rooms →
        </Link>
      </div>

      <div className="landing-rooms-grid grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-[18px]">
        {displayRooms.map((r) => (
          <Link
            key={r.slug}
            href={`/rooms/${r.slug}`}
            className="rounded-[18px] overflow-hidden border border-[var(--line)] shadow-[0_16px_40px_#0006] cursor-pointer hover:border-[color-mix(in_srgb,var(--glow)_35%,transparent)] transition-colors"
            style={{ background: "linear-gradient(180deg, #1c120b, #100a06)" }}
          >
            <div className="relative h-[148px] overflow-hidden" style={{ background: r.bg }}>
              <div
                className="landing-glow-pulse absolute top-3.5 left-1/2 -translate-x-1/2 w-40 h-[120px] blur-[8px]"
                style={{
                  background: `radial-gradient(circle at 50% 30%, ${r.glow}, transparent 64%)`,
                  animationDuration: "5s",
                }}
              />
              <div
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[180px] h-[54px] border-t-2"
                style={{
                  background: `linear-gradient(180deg, ${r.stage}, transparent)`,
                  clipPath: "polygon(20% 0, 80% 0, 100% 100%, 0 100%)",
                  borderColor: r.glow,
                }}
              />
              <div
                className="landing-wobble absolute bottom-[18px] left-1/2 -translate-x-1/2 w-[30px] h-8"
                style={{
                  borderRadius: "48% 48% 44% 44% / 56% 56% 44% 44%",
                  background: `radial-gradient(circle at 40% 28%, #ffffff88, #fff0 46%), ${r.dj}`,
                  animationDuration: "1.8s",
                }}
              />
              {r.blobs.map((b, bi) => (
                <div
                  key={bi}
                  className="landing-bob absolute"
                  style={{
                    bottom: b.b,
                    left: b.l,
                    width: b.s,
                    height: b.s,
                    borderRadius: "48% 48% 44% 44% / 56% 56% 44% 44%",
                    background: b.c,
                    animationDuration: b.d,
                  }}
                />
              ))}
              <div className="absolute top-[11px] left-[11px] flex items-center gap-[5px] px-2 py-[3px] rounded-[20px] bg-[#000000a0] backdrop-blur-[6px]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#36e07f] shadow-[0_0_6px_#36e07f]" />
                <span className="text-[10px] font-bold text-white">{r.count}</span>
              </div>
            </div>
            <div className="px-[15px] pt-3.5 pb-4">
              <div className="font-display font-bold text-base mb-[3px]">{r.name}</div>
              <div className="text-xs text-[var(--sub)] truncate">♪ {r.track}</div>
              <div
                className="mt-[11px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[20px] border"
                style={{
                  background: `color-mix(in srgb, ${r.glow} 14%, transparent)`,
                  borderColor: `color-mix(in srgb, ${r.glow} 30%, transparent)`,
                }}
              >
                <span className="text-[11px] font-bold" style={{ color: r.glow }}>
                  {r.tag}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
