"use client";

import { useState, useCallback } from "react";
import { RoomHeader } from "./RoomHeader";
import { NowPlaying } from "./NowPlaying";
import { DJBooth } from "./DJBooth";
import { QueuePanel } from "./QueuePanel";
import { ChatPanel } from "./ChatPanel";
import { ListenerList } from "./ListenerList";
import { RoomVibePanel } from "./RoomVibePanel";
import { TrackSubmitForm } from "./TrackSubmitForm";
import { useRoomRealtime } from "@/hooks/useRoomRealtime";
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
  };
}

export function RoomClient({ room, initialData }: RoomClientProps) {
  const [playback, setPlayback] = useState(initialData.playback);
  const [members, setMembers] = useState(initialData.members);
  const [djSlots, setDjSlots] = useState(initialData.djSlots);
  const [waitlist, setWaitlist] = useState(initialData.waitlist);
  const [queueItems, setQueueItems] = useState(initialData.queueItems);
  const [votes, setVotes] = useState(initialData.votes);
  const [userVotes, setUserVotes] = useState(initialData.userVotes);
  const [userSaved, setUserSaved] = useState(initialData.userSaved);

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
    setUserVotes(data.userVotes);
    setUserSaved(data.userSaved);
  }, [room.slug]);

  useRoomRealtime({
    roomId: room.id,
    roomSlug: room.slug,
    onPlaybackChange: refresh,
    onMembersChange: refresh,
    onDjChange: refresh,
    onQueueChange: refresh,
    onVotesChange: refresh,
  });

  const handleTrackEnded = useCallback(async () => {
    await fetch(`/api/rooms/${room.slug}/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "ended" }),
    });
    await refresh();
  }, [room.slug, refresh]);

  const handleSkip = useCallback(async () => {
    await fetch(`/api/rooms/${room.slug}/skip`, { method: "POST" });
    await refresh();
  }, [room.slug, refresh]);

  const track = playback?.track as Track | null;
  const dj = playback?.dj as User | null;
  const currentUserId = initialData.currentUserId;
  const isUserDj = djSlots.some((s) => s.user_id === currentUserId);
  const isUserWaitlisted = waitlist.some((w) => w.user_id === currentUserId);
  const hasQueuedTrack = queueItems.some(
    (q) => q.dj_user_id === currentUserId
  );
  const isCurrentDj = playback?.current_dj_user_id === currentUserId;

  return (
    <div className="min-h-screen flex flex-col">
      <RoomHeader room={room} listenerCount={members.length} />

      <div className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6">
          {/* Main column */}
          <div className="lg:col-span-7 space-y-4">
            <NowPlaying
              playback={playback}
              track={track}
              dj={dj}
              votes={votes}
              userVotes={userVotes}
              userSaved={userSaved}
              roomSlug={room.slug}
              canSkip={isCurrentDj && !!track}
              onTrackEnded={handleTrackEnded}
              onSkip={handleSkip}
            />

            <DJBooth
              djSlots={djSlots}
              waitlist={waitlist}
              currentDjUserId={playback?.current_dj_user_id || null}
              currentUserId={currentUserId}
              maxDjs={room.max_djs}
              roomSlug={room.slug}
              isUserDj={isUserDj}
              isUserWaitlisted={isUserWaitlisted}
            />

            <TrackSubmitForm
              roomSlug={room.slug}
              isDj={isUserDj}
              hasQueuedTrack={hasQueuedTrack}
            />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-5 space-y-4">
            <QueuePanel
              queueItems={queueItems}
              currentDjUserId={playback?.current_dj_user_id || null}
              djSlots={djSlots}
            />

            <ChatPanel
              roomSlug={room.slug}
              initialMessages={initialData.messages}
              currentUserId={currentUserId}
            />

            <ListenerList
              members={members}
              currentUserId={currentUserId}
            />

            <RoomVibePanel room={room} />
          </div>
        </div>
      </div>
    </div>
  );
}
