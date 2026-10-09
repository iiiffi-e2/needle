"use client";

import { useEffect, useState } from "react";
import type { FriendWithPresence, RoomWithStats } from "@/lib/types";
import { formatListenerCount, heroDeckLabel, landingMarquee } from "@/lib/landing-honesty";
import { partitionRooms } from "@/lib/room-liveness";
import { LandingNav } from "./LandingNav";
import { HeroVenue } from "./HeroVenue";
import { HeroStatement } from "./HeroStatement";
import { FriendsOnTheFloor } from "./FriendsOnTheFloor";
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

interface LiveFloor {
  friends: FriendWithPresence[];
  yourRooms: { id: string; name: string; slug: string }[];
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
  const [floor, setFloor] = useState<LiveFloor | null>(null);

  useEffect(() => {
    fetch("/api/rooms")
      .then((res) => res.json())
      .then((data: RoomWithStats[]) => {
        if (!Array.isArray(data)) return;
        setRooms(data);
        setLiveCount(formatListenerCount(listenerSum(data)));
      })
      .catch(() => {});

    if (!isLoggedIn) return;

    fetch("/api/me/live")
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data: LiveFloor | null) => {
        if (!data || !Array.isArray(data.friends) || !Array.isArray(data.yourRooms)) return;
        setFloor(data);
      })
      .catch(() => {});
  }, [isLoggedIn]);

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
        {isLoggedIn && floor ? (
          <FriendsOnTheFloor friends={floor.friends} yourRooms={floor.yourRooms} />
        ) : null}
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
