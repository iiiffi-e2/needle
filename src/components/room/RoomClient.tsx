"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { RoomTopBar } from "@/components/venue/RoomTopBar";
import { VenueCanvas } from "@/components/venue/VenueCanvas";
import { NowPlayingPanel } from "@/components/venue/NowPlayingPanel";
import {
  QuickReacts,
  ReactionBursts,
  type ReactionBurst,
} from "@/components/venue/QuickReacts";
import { DropTrackBar } from "@/components/venue/DropTrackBar";
import { RoomSidePanel, type TabId } from "@/components/venue/RoomSidePanel";
import { YouTubePlayer } from "@/components/room/YouTubePlayer";
import { useRoomRealtime } from "@/hooks/useRoomRealtime";
import { getEffectiveEnergy } from "@/lib/room-energy";
import type {
  Room,
  RoomPlayback,
  RoomMember,
  DjSlot,
  DjWaitlistEntry,
  QueueItem,
  Track,
  User,
  ChatMessage,
} from "@/lib/types";

interface RoomClientProps {
  room: Room;
  initialData: {
    playback: RoomPlayback | null;
    members: RoomMember[];
    djSlots: DjSlot[];
    waitlist: DjWaitlistEntry[];
    queueItems: QueueItem[];
    votes: { awesome: number; lame: number };
    userVotes: string[];
    userSaved: boolean;
    currentUserId: string | null;
    messages: ChatMessage[];
    energy: number;
    energyUpdatedAt: string;
  };
}

export function RoomClient({ room, initialData }: RoomClientProps) {
  const [playback, setPlayback] = useState(initialData.playback);
  const [members, setMembers] = useState(initialData.members);
  const [djSlots, setDjSlots] = useState(initialData.djSlots);
  const [waitlist, setWaitlist] = useState(initialData.waitlist);
  const [queueItems, setQueueItems] = useState(initialData.queueItems);
  const [votes, setVotes] = useState(initialData.votes);
  const [myVote, setMyVote] = useState<"awesome" | "lame" | null>(
    (initialData.userVotes[0] as "awesome" | "lame") || null
  );
  const [userSaved, setUserSaved] = useState(initialData.userSaved);
  const [storedEnergy, setStoredEnergy] = useState(initialData.energy);
  const [energyUpdatedAt, setEnergyUpdatedAt] = useState(
    initialData.energyUpdatedAt
  );
  const [energy, setEnergy] = useState(initialData.energy);
  const [bursts, setBursts] = useState<ReactionBurst[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [sideTab, setSideTab] = useState<TabId>("chat");
  const [deckLoading, setDeckLoading] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/rooms/${room.slug}`);
    if (!res.ok) return;
    const data = await res.json();
    setPlayback(data.playback);
    setMembers(data.members);
    setDjSlots(data.djSlots);
    setWaitlist(data.waitlist);
    setQueueItems(data.queueItems);
    setVotes(data.votes);
    setMyVote((data.userVotes?.[0] as "awesome" | "lame") || null);
    setUserSaved(data.userSaved);
    if (data.room) {
      setStoredEnergy(data.room.room_energy ?? 30);
      setEnergyUpdatedAt(
        data.room.room_energy_updated_at ?? new Date().toISOString()
      );
    }
  }, [room.slug]);

  useRoomRealtime({
    roomId: room.id,
    roomSlug: room.slug,
    onPlaybackChange: refresh,
    onMembersChange: refresh,
    onDjChange: refresh,
    onQueueChange: refresh,
    onVotesChange: refresh,
    onEnergyChange: refresh,
  });

  useEffect(() => {
    const tick = () => {
      setEnergy(getEffectiveEnergy(storedEnergy, energyUpdatedAt));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [storedEnergy, energyUpdatedAt]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2300);
  }, []);

  const fling = useCallback((glyph: string, color: string) => {
    const id = Math.random().toString(36).slice(2);
    const left = `${15 + Math.random() * 70}%`;
    const size = `${22 + Math.random() * 16}px`;
    setBursts((prev) => [...prev, { id, glyph, color, left, size }]);
    setTimeout(
      () => setBursts((prev) => prev.filter((b) => b.id !== id)),
      1600
    );
  }, []);

  const flingBurst = useCallback(
    (glyph: string, color: string, n = 4) => {
      for (let i = 0; i < n; i++) {
        setTimeout(() => fling(glyph, color), i * 120);
      }
    },
    [fling]
  );

  useEffect(() => {
    if (energy <= 45) return;
    const id = setInterval(() => {
      if (Math.random() < energy / 140) {
        fling("♪", "#5ad1c8");
      }
    }, 1400);
    return () => clearInterval(id);
  }, [energy, fling]);

  const handleTrackEnded = useCallback(async () => {
    await fetch(`/api/rooms/${room.slug}/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "ended" }),
    });
    await refresh();
  }, [room.slug, refresh]);

  const handleVote = useCallback(
    async (voteType: "awesome" | "lame") => {
      const res = await fetch(`/api/rooms/${room.slug}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voteType }),
      });
      if (!res.ok) return;
      const data = await res.json();

      if (data.removed) {
        setMyVote(null);
        setVotes((prev) => ({
          ...prev,
          [voteType]: Math.max(0, prev[voteType] - 1),
        }));
      } else {
        const wasOther = myVote && myVote !== voteType ? myVote : null;
        setMyVote(voteType);
        setVotes((prev) => {
          const next = { ...prev, [voteType]: prev[voteType] + 1 };
          if (wasOther) {
            next[wasOther] = Math.max(0, next[wasOther] - 1);
          }
          return next;
        });
        if (voteType === "awesome") {
          flingBurst("▲", "#62e08a", 4);
        }
      }
      await refresh();
    },
    [room.slug, refresh, flingBurst, myVote]
  );

  const handleSave = useCallback(async () => {
    const res = await fetch(`/api/rooms/${room.slug}/save`, {
      method: "POST",
    });
    if (res.ok) {
      setUserSaved(true);
      showToast("♥ Saved to your crate");
      fling("♥", "#ff6fae");
    }
  }, [room.slug, showToast, fling]);

  const handleJoinDeck = async () => {
    setDeckLoading(true);
    try {
      const res = await fetch(`/api/rooms/${room.slug}/dj`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast("You're on the deck — line up a track");
        flingBurst("★", "#ffd166", 3);
        await refresh();
      } else {
        showToast(data.error || "Could not join deck");
      }
    } finally {
      setDeckLoading(false);
    }
  };

  const handleLeaveDeck = async () => {
    setDeckLoading(true);
    try {
      await fetch(`/api/rooms/${room.slug}/dj`, { method: "DELETE" });
      await refresh();
    } finally {
      setDeckLoading(false);
    }
  };

  const track = playback?.track as Track | null;
  const dj = playback?.dj as User | null;
  const currentUserId = initialData.currentUserId;
  const djUserIds = useMemo(
    () => new Set(djSlots.map((s) => s.user_id)),
    [djSlots]
  );
  const isUserDj = djSlots.some((s) => s.user_id === currentUserId);
  const isUserWaitlisted = waitlist.some((w) => w.user_id === currentUserId);
  const hasQueuedTrack = queueItems.some(
    (q) => q.dj_user_id === currentUserId
  );
  const currentUser = members.find((m) => m.user_id === currentUserId)?.user;

  const currentDjId = playback?.current_dj_user_id || null;
  const sideDjs = useMemo((): [DjSlot | null, DjSlot | null] => {
    const others = djSlots
      .filter((s) => s.user_id !== currentDjId)
      .sort((a, b) => a.position - b.position);
    return [others[0] || null, others[1] || null];
  }, [djSlots, currentDjId]);

  const marquee = track
    ? `NOW SPINNING · ${track.title}${track.artist ? ` — ${track.artist}` : ""} · played by ${dj?.display_name || "DJ"} · `
    : `${room.name} · The booth is open · Drop a track to get moving · `;

  return (
    <div className="needle-room">
      <RoomTopBar
        room={room}
        listenerCount={members.length}
        energy={energy}
        currentUser={currentUser}
      />

      <div className="needle-room-body">
        <div className="needle-venue-column">
          <div className="needle-venue-scene">
            <VenueCanvas
              currentDj={dj}
              sideDjs={sideDjs}
              members={members}
              djUserIds={djUserIds}
              currentUserId={currentUserId}
              energy={energy}
              marquee={marquee}
              canJoinDeck={!isUserDj && !isUserWaitlisted && !!currentUserId}
              onJoinDeck={handleJoinDeck}
              onLeaveDeck={handleLeaveDeck}
              deckLoading={deckLoading}
            />
            <ReactionBursts bursts={bursts} />
            <QuickReacts roomSlug={room.slug} onBurst={fling} />
            <NowPlayingPanel
              playback={playback}
              track={track}
              dj={dj}
              votes={votes}
              myVote={myVote}
              userSaved={userSaved}
              onVote={handleVote}
              onSave={handleSave}
            />
          </div>
          <DropTrackBar
            roomSlug={room.slug}
            isDj={isUserDj}
            hasQueuedTrack={hasQueuedTrack}
            onOpenCrate={() => setSideTab("queue")}
            onToast={showToast}
          />
        </div>

        <RoomSidePanel
          room={room}
          members={members}
          queueItems={queueItems}
          djSlots={djSlots}
          djUserIds={djUserIds}
          listenerCount={members.length}
          roomSlug={room.slug}
          initialMessages={initialData.messages}
          currentUserId={currentUserId}
          activeTab={sideTab}
          onTabChange={setSideTab}
        />
      </div>

      {toast && (
        <div
          className="fixed z-[90] px-[18px] py-2.5 rounded-full font-extrabold text-[13px] text-[#1a0d06] animate-ndl-toast pointer-events-none"
          style={{
            bottom: 104,
            left: "50%",
            transform: "translateX(-50%)",
            background: "linear-gradient(120deg, var(--glow), var(--accent))",
            boxShadow: "0 10px 30px rgba(255, 157, 60, 0.55)",
          }}
        >
          {toast}
        </div>
      )}

      {track?.provider === "youtube" && track.provider_id && playback && (
        <YouTubePlayer
          videoId={track.provider_id}
          startedAt={playback.started_at}
          durationSeconds={track.duration_seconds}
          isPaused={playback.is_paused}
          onEnded={handleTrackEnded}
        />
      )}
    </div>
  );
}
