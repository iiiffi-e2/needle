"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  floorPingsFrom,
  nextFloorPings,
  type FloorPing,
} from "@/lib/floor-return";
import type { FriendWithPresence } from "@/lib/types";

const POLL_MS = 30_000;

interface LivePayload {
  friends: FriendWithPresence[];
  yourRooms: { id: string; name: string; slug: string }[];
}

export function FriendFloorToast() {
  const router = useRouter();
  const previousIds = useRef<string[] | null>(null);
  const [ping, setPing] = useState<FloorPing | null>(null);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | undefined;
    let activeUserId: string | null = null;
    let pollGeneration = 0;
    const supabase = createClient();

    const clearPoll = () => {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    const tick = async (generation: number) => {
      try {
        const res = await fetch("/api/me/live");
        if (!res.ok || cancelled || generation !== pollGeneration) return;
        const data = (await res.json()) as Partial<LivePayload>;
        if (cancelled || generation !== pollGeneration) return;
        if (!Array.isArray(data.friends) || !Array.isArray(data.yourRooms)) return;

        const pings = floorPingsFrom(data.friends, data.yourRooms);
        const fresh = nextFloorPings(previousIds.current, pings);
        if (cancelled || generation !== pollGeneration) return;
        previousIds.current = pings.map((item) => item.id);
        if (fresh.length > 0) setPing(fresh[0]);
      } catch {
        // Skip this tick when the request fails.
      }
    };

    const startPolling = (userId: string) => {
      clearPoll();
      activeUserId = userId;
      previousIds.current = null;
      const generation = ++pollGeneration;
      void tick(generation);
      intervalId = setInterval(() => {
        void tick(generation);
      }, POLL_MS);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      const userId = session?.user?.id ?? null;
      if (!userId) {
        pollGeneration += 1;
        clearPoll();
        previousIds.current = null;
        activeUserId = null;
        setPing(null);
        return;
      }
      if (userId === activeUserId) return;
      setPing(null);
      startPolling(userId);
    });

    return () => {
      cancelled = true;
      pollGeneration += 1;
      clearPoll();
      subscription.unsubscribe();
    };
  }, []);

  if (!ping) return null;

  return (
    <div className="fixed bottom-24 right-4 z-50 max-w-[320px]">
      <div className="glass-panel rounded-2xl border border-[var(--ndl-line)] px-4 py-3 shadow-[0_16px_38px_rgba(0,0,0,0.55)]">
        <p className="text-sm font-semibold leading-snug">{ping.label}</p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push(ping.href)}
            className="btn-primary px-4 py-2 rounded-full text-xs font-extrabold"
          >
            Join
          </button>
          <button
            type="button"
            onClick={() => setPing(null)}
            className="btn-secondary px-4 py-2 rounded-full text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
