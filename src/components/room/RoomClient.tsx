"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { RoomTopBar } from "@/components/venue/RoomTopBar";
import { VenueCanvas } from "@/components/venue/VenueCanvas";
import { NowPlayingPanel } from "@/components/venue/NowPlayingPanel";
import {
  QuickReacts,
  ReactionBursts,
  type ReactionBurst,
} from "@/components/venue/QuickReacts";
import { DropTrackBar } from "@/components/venue/DropTrackBar";
import { MobileNowPlayingBar } from "@/components/venue/MobileNowPlayingBar";
import { MobileBottomNav } from "@/components/venue/MobileBottomNav";
import { DropSheet } from "@/components/venue/DropSheet";
import { RoomSidePanel, type TabId } from "@/components/venue/RoomSidePanel";
import { YouTubePlayer } from "@/components/room/YouTubePlayer";
import { useRoomRealtime } from "@/hooks/useRoomRealtime";
import { getEffectiveEnergy } from "@/lib/room-energy";
import {
  HEAD_REACTION_DURATION_MS,
  type CrowdHeadReaction,
} from "@/lib/crowd-reactions";
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
  const [headReactions, setHeadReactions] = useState<CrowdHeadReaction[]>([]);
  const headReactionCounts = useRef<Map<string, number>>(new Map());
  const [toast, setToast] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [playerDuration, setPlayerDuration] = useState<number | null>(null);
  const [sideTab, setSideTab] = useState<TabId>("chat");
  const [mobileDrawer, setMobileDrawer] = useState<TabId | null>(null);
  const [dropSheetOpen, setDropSheetOpen] = useState(false);
  const [deckLoading, setDeckLoading] = useState(false);
  const advancingQueueItemRef = useRef<string | null>(null);
  const advancedQueueItemsRef = useRef(new Set<string>());

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

  const spawnHeadReaction = useCallback(
    (userId: string, glyph: string, color: string) => {
      const count = headReactionCounts.current.get(userId) ?? 0;
      headReactionCounts.current.set(userId, count + 1);

      const id = Math.random().toString(36).slice(2);
      const delay = (count % 4) * 0.12;
      const offset = ((count % 5) - 2) * 6;
      const reaction: CrowdHeadReaction = {
        id,
        userId,
        glyph,
        color,
        delay,
        offset,
      };

      setHeadReactions((prev) => [...prev, reaction]);
      setTimeout(() => {
        setHeadReactions((prev) => prev.filter((r) => r.id !== id));
      }, HEAD_REACTION_DURATION_MS + delay * 1000);
    },
    []
  );

  const handleRemoteCrowdReact = useCallback(
    (payload: { userId: string; glyph: string; color: string }) => {
      if (payload.userId === initialData.currentUserId) return;
      spawnHeadReaction(payload.userId, payload.glyph, payload.color);
    },
    [initialData.currentUserId, spawnHeadReaction]
  );

  const { broadcastCrowdReact } = useRoomRealtime({
    roomId: room.id,
    roomSlug: room.slug,
    onPlaybackChange: refresh,
    onMembersChange: refresh,
    onDjChange: refresh,
    onQueueChange: refresh,
    onVotesChange: refresh,
    onEnergyChange: refresh,
    onCrowdReact: handleRemoteCrowdReact,
  });

  const handleQuickReact = useCallback(
    (glyph: string, color: string, _type: string) => {
      if (!initialData.currentUserId) return;
      spawnHeadReaction(initialData.currentUserId, glyph, color);
      broadcastCrowdReact({
        userId: initialData.currentUserId,
        glyph,
        color,
      });
    },
    [initialData.currentUserId, spawnHeadReaction, broadcastCrowdReact]
  );

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

  const currentUserId = initialData.currentUserId;

  const handleTrackEnded = useCallback(
    async (finishedQueueItemId: string) => {
      if (!finishedQueueItemId) return;
      if (advancedQueueItemsRef.current.has(finishedQueueItemId)) return;
      if (advancingQueueItemRef.current === finishedQueueItemId) return;
      advancingQueueItemRef.current = finishedQueueItemId;

      try {
        const res = await fetch(`/api/rooms/${room.slug}/advance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: "ended",
            queueItemId: finishedQueueItemId,
          }),
        });
        if (res.ok) {
          advancedQueueItemsRef.current.add(finishedQueueItemId);
        }
        await refresh();
      } finally {
        if (advancingQueueItemRef.current === finishedQueueItemId) {
          advancingQueueItemRef.current = null;
        }
      }
    },
    [room.slug, refresh]
  );

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

  useEffect(() => {
    setPlayerDuration(null);
  }, [track?.id]);

  const effectiveDuration =
    playerDuration ?? track?.duration_seconds ?? 0;

  const handleDurationReady = useCallback((seconds: number) => {
    setPlayerDuration(seconds);
  }, []);

  const djUserIds = useMemo(
    () => new Set(djSlots.map((s) => s.user_id)),
    [djSlots]
  );
  const isUserDj = djSlots.some((s) => s.user_id === currentUserId);
  const isUserWaitlisted = waitlist.some((w) => w.user_id === currentUserId);
  const currentUser = members.find((m) => m.user_id === currentUserId)?.user;

  const currentDjId = playback?.current_dj_user_id || null;
  const sideDjs = useMemo((): [DjSlot | null, DjSlot | null] => {
    const others = djSlots
      .filter((s) => s.user_id !== currentDjId)
      .sort((a, b) => a.position - b.position);
    return [others[0] || null, others[1] || null];
  }, [djSlots, currentDjId]);

  const isDjSleeping = !!dj && !track;

  const isMobile = useMediaQuery("(max-width: 1023px)");

  const handleMobileDrawer = useCallback((tab: TabId) => {
    setDropSheetOpen(false);
    setSideTab(tab);
    setMobileDrawer((prev) => (prev === tab ? null : tab));
  }, []);

  const handleDropOpen = useCallback(() => {
    setMobileDrawer(null);
    setDropSheetOpen(true);
  }, []);

  const closeMobileDrawer = useCallback(() => {
    setMobileDrawer(null);
  }, []);

  const marquee = track
    ? `NOW SPINNING · ${track.title}${track.artist ? ` — ${track.artist}` : ""} · played by ${dj?.display_name || "DJ"} · `
    : isDjSleeping
      ? `${dj?.display_name || "DJ"} is resting — drop a track to wake the booth · `
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
              isDjSleeping={isDjSleeping}
              sideDjs={sideDjs}
              members={members}
              djUserIds={djUserIds}
              currentUserId={currentUserId}
              energy={energy}
              marquee={marquee}
              headReactions={headReactions}
              canJoinDeck={!isUserDj && !isUserWaitlisted && !!currentUserId}
              onJoinDeck={handleJoinDeck}
              onLeaveDeck={handleLeaveDeck}
              deckLoading={deckLoading}
            />
            <ReactionBursts bursts={bursts} />
            <QuickReacts roomSlug={room.slug} onReact={handleQuickReact} />
            <NowPlayingPanel
              playback={playback}
              track={track}
              dj={dj}
              votes={votes}
              myVote={myVote}
              userSaved={userSaved}
              durationSeconds={effectiveDuration}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted((m) => !m)}
              onVote={handleVote}
              onSave={handleSave}
            />
            <MobileNowPlayingBar
              playback={playback}
              track={track}
              dj={dj}
              myVote={myVote}
              userSaved={userSaved}
              durationSeconds={effectiveDuration}
              onVote={handleVote}
              onSave={handleSave}
            />
          </div>
          <DropTrackBar
            roomSlug={room.slug}
            isDj={isUserDj}
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
          currentDjUserId={currentDjId}
          activeTab={sideTab}
          onTabChange={setSideTab}
          hideTabBar={isMobile}
          mobileDrawerOpen={isMobile && mobileDrawer !== null}
          onCloseDrawer={closeMobileDrawer}
        />
      </div>

      <MobileBottomNav
        activeDrawer={mobileDrawer}
        queueCount={queueItems.length}
        onOpenDrawer={handleMobileDrawer}
        onDrop={handleDropOpen}
      />

      <DropSheet
        open={dropSheetOpen}
        roomSlug={room.slug}
        isDj={isUserDj}
        onClose={() => setDropSheetOpen(false)}
        onOpenQueue={() => {
          setSideTab("queue");
          setMobileDrawer("queue");
        }}
        onToast={showToast}
      />

      {toast && (
        <div
          className="fixed z-[90] px-[18px] py-2.5 rounded-full font-extrabold text-[13px] text-[#1a0d06] animate-ndl-toast pointer-events-none needle-mobile-toast"
          style={{
            bottom: isMobile ? undefined : 104,
            left: "50%",
            transform: "translateX(-50%)",
            background: "linear-gradient(120deg, var(--glow), var(--accent))",
            boxShadow: "0 10px 30px rgba(255, 157, 60, 0.55)",
          }}
        >
          {toast}
        </div>
      )}

      {track?.provider === "youtube" && track.provider_id && playback?.current_queue_item_id && (
        <YouTubePlayer
          videoId={track.provider_id}
          sessionId={playback.current_queue_item_id}
          startedAt={playback.started_at}
          durationSeconds={effectiveDuration || track.duration_seconds}
          isPaused={playback.is_paused}
          muted={isMuted}
          onEnded={handleTrackEnded}
          onDurationReady={handleDurationReady}
        />
      )}
    </div>
  );
}
