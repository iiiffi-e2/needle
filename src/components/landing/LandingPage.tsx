"use client";

import { useEffect, useState } from "react";
import type { RoomWithStats } from "@/lib/types";
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
  hero?: "venue" | "statement";
}

function formatLiveCount(totalListeners: number): string {
  if (totalListeners >= 1000) {
    return totalListeners.toLocaleString();
  }
  if (totalListeners > 0) return String(totalListeners);
  return "1,204";
}

export function LandingPage({ isLoggedIn = false, hero = "venue" }: LandingPageProps) {
  const [rooms, setRooms] = useState<RoomWithStats[]>([]);
  const [liveCount, setLiveCount] = useState("1,204");

  useEffect(() => {
    fetch("/api/rooms")
      .then((res) => res.json())
      .then((data: RoomWithStats[]) => {
        if (!Array.isArray(data)) return;
        setRooms(data);
        const listeners = data.reduce(
          (sum, room) => sum + (room.listener_count ?? 0),
          0
        );
        if (listeners > 0) {
          setLiveCount(formatLiveCount(listeners));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="landing-page ndl-scroll min-h-screen w-full overflow-x-hidden">
      <div className="mx-auto w-full max-w-[1440px]">
        <LandingNav isLoggedIn={isLoggedIn} />
        {hero === "statement" ? (
          <HeroStatement liveCount={liveCount} isLoggedIn={isLoggedIn} />
        ) : (
          <HeroVenue liveCount={liveCount} isLoggedIn={isLoggedIn} />
        )}
        <LiveRoomsSection rooms={rooms} />
        <FeaturesSection />
        <SocialProofSection />
        <FooterCta isLoggedIn={isLoggedIn} />
      </div>
    </div>
  );
}
