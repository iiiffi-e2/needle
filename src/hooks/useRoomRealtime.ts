"use client";

import { useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/lib/types";

export interface CrowdReactPayload {
  userId: string;
  glyph: string;
  color: string;
}

interface UseRoomRealtimeOptions {
  roomId: string;
  roomSlug: string;
  onPlaybackChange: () => void;
  onMembersChange: () => void;
  onDjChange: () => void;
  onQueueChange: () => void;
  onVotesChange: () => void;
  onEnergyChange: () => void;
  onCrowdReact?: (payload: CrowdReactPayload) => void;
}

export function useRoomRealtime({
  roomId,
  roomSlug,
  onPlaybackChange,
  onMembersChange,
  onDjChange,
  onQueueChange,
  onVotesChange,
  onEnergyChange,
  onCrowdReact,
}: UseRoomRealtimeOptions) {
  const supabase = createClient();
  const presenceInterval = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refreshPlayback = useCallback(onPlaybackChange, [onPlaybackChange]);
  const refreshMembers = useCallback(onMembersChange, [onMembersChange]);
  const refreshDj = useCallback(onDjChange, [onDjChange]);
  const refreshQueue = useCallback(onQueueChange, [onQueueChange]);
  const refreshVotes = useCallback(onVotesChange, [onVotesChange]);
  const refreshEnergy = useCallback(onEnergyChange, [onEnergyChange]);
  const handleCrowdReact = useCallback(
    (payload: CrowdReactPayload) => onCrowdReact?.(payload),
    [onCrowdReact]
  );

  useEffect(() => {
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_playback",
          filter: `room_id=eq.${roomId}`,
        },
        () => refreshPlayback()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_members",
          filter: `room_id=eq.${roomId}`,
        },
        () => refreshMembers()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dj_slots",
          filter: `room_id=eq.${roomId}`,
        },
        () => refreshDj()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dj_waitlist",
          filter: `room_id=eq.${roomId}`,
        },
        () => refreshDj()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "queue_items",
          filter: `room_id=eq.${roomId}`,
        },
        () => refreshQueue()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "track_votes",
          filter: `room_id=eq.${roomId}`,
        },
        () => refreshVotes()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        () => refreshEnergy()
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const message = payload.new as ChatMessage;
          const addMessage = (
            window as unknown as {
              __needleAddChatMessage?: (m: ChatMessage) => void;
            }
          ).__needleAddChatMessage;
          if (addMessage) {
            addMessage(message);
          }
        }
      )
      .on("broadcast", { event: "crowd_react" }, ({ payload }) => {
        handleCrowdReact(payload as CrowdReactPayload);
      })
      .subscribe();

    channelRef.current = channel;

    // Heartbeat presence while the tab is open (including passive listening).
    const ping = () => {
      fetch(`/api/rooms/${roomSlug}/presence`, { method: "POST" }).catch(
        () => {}
      );
    };

    const leaveRoom = () => {
      fetch(`/api/rooms/${roomSlug}/presence`, {
        method: "DELETE",
        keepalive: true,
      }).catch(() => {});
    };

    const handlePageHide = (event: PageTransitionEvent) => {
      if (event.persisted) return;
      leaveRoom();
    };

    ping();
    presenceInterval.current = setInterval(ping, 30000);

    window.addEventListener("pagehide", handlePageHide);

    // Occasional Needlebot
    const needlebotTimer = setInterval(() => {
      if (Math.random() < 0.05) {
        fetch(`/api/rooms/${roomSlug}/needlebot`, { method: "POST" }).catch(
          () => {}
        );
      }
    }, 120000);

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
      if (presenceInterval.current) clearInterval(presenceInterval.current);
      clearInterval(needlebotTimer);
      window.removeEventListener("pagehide", handlePageHide);

      leaveRoom();
    };
  }, [
    roomId,
    roomSlug,
    supabase,
    refreshPlayback,
    refreshMembers,
    refreshDj,
    refreshQueue,
    refreshVotes,
    refreshEnergy,
    handleCrowdReact,
  ]);

  const broadcastCrowdReact = useCallback((payload: CrowdReactPayload) => {
    channelRef.current?.send({
      type: "broadcast",
      event: "crowd_react",
      payload,
    });
  }, []);

  return { broadcastCrowdReact };
}
