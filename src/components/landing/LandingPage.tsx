"use client";

import { useEffect, useState } from "react";
import type { RoomWithStats } from "@/lib/types";
import { formatListenerCount, heroDeckLabel, landingMarquee } from "@/lib/landing-honesty";
import { partitionRooms } from "@/lib/room-liveness";
import { LandingNav } from "./LandingNav";
import { HeroVenue } from "./HeroVenue";
import { HeroStatement } from "./HeroStatement";
import { LiveRoomsSection } from "./LiveRoomsSection";
import { FeaturesSection } from "./FeaturesSection";
import { SocialProofSection } from "./SocialProofSection";
import { FooterCta } from "./FooterCta";
import "./landing.css";

interface LandingPageProps {
  isLoggedIn?: boolean;
  userId?: string;
  displayName?: string;
  hero?: "venue" | "statement";
}

function listenerSum(rooms: RoomWithStats[]): number {
  return rooms.reduce((sum, room) => sum + (room.listener_count ?? 0), 0);
}

export function LandingPage({
  isLoggedIn = false,
  userId,
  displayName,
  hero = "venue",
}: LandingPageProps) {
  const [rooms, setRooms] = useState<RoomWithStats[]>([]);
  const [liveCount, setLiveCount] = useState("0");

  useEffect(() => {
    fetch("/api/rooms")
      .then((res) => res.json())
      .then((data: RoomWithStats[]) => {
        if (!Array.isArray(data)) return;
        setRooms(data);
        setLiveCount(formatListenerCount(listenerSum(data)));
      })
      .catch(() => {});
  }, []);

  const listenerTotal = listenerSum(rooms);
  const spinning = partitionRooms(rooms).spinning;
  const headline = spinning[0] ?? null;

  return (
    <div className="landing-page ndl-scroll min-h-screen w-full overflow-x-hidden">
      <div className="mx-auto w-full max-w-[1440px]">
        <LandingNav
          isLoggedIn={isLoggedIn}
          userId={userId}
          displayName={displayName}
        />
        {hero === "statement" ? (
          <HeroStatement liveCount={liveCount} isLoggedIn={isLoggedIn} />
        ) : (
          <HeroVenue
            liveCount={liveCount}
            isLoggedIn={isLoggedIn}
            marquee={landingMarquee(headline)}
            deckLabel={heroDeckLabel(headline)}
          />
        )}
        <LiveRoomsSection rooms={rooms} />
        <FeaturesSection />
        <SocialProofSection
          spinningCount={spinning.length}
          listenerTotal={listenerTotal}
        />
        <FooterCta isLoggedIn={isLoggedIn} />
      </div>
    </div>
  );
}
