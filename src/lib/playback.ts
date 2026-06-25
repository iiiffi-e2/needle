import type { SupabaseClient } from "@supabase/supabase-js";

export async function postSystemMessage(
  supabase: SupabaseClient,
  roomId: string,
  body: string
) {
  await supabase.from("chat_messages").insert({
    room_id: roomId,
    body,
    is_system: true,
    user_id: null,
  });
}

export interface AdvancePlaybackOptions {
  /** When true, play the current DJ's next queued track instead of rotating. */
  stayOnCurrentDj?: boolean;
  /** Booth position of a DJ who just stepped off; advance to the next DJ in line. */
  afterDepartedDjPosition?: number;
}

export async function advancePlayback(
  supabase: SupabaseClient,
  roomId: string,
  reason: "ended" | "skipped" | "no_track" = "ended",
  options: AdvancePlaybackOptions = {}
) {
  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (!room) return { error: "Room not found" };

  const { data: playback } = await supabase
    .from("room_playback")
    .select("*")
    .eq("room_id", roomId)
    .single();

  if (playback?.current_queue_item_id) {
    await supabase
      .from("queue_items")
      .update({
        status: reason === "skipped" ? "skipped" : "played",
        played_at: new Date().toISOString(),
      })
      .eq("id", playback.current_queue_item_id);
  }

  const { data: djSlots } = await supabase
    .from("dj_slots")
    .select("*, user:users(*)")
    .eq("room_id", roomId)
    .order("position");

  if (!djSlots || djSlots.length === 0) {
    await supabase.from("room_playback").upsert({
      room_id: roomId,
      current_track_id: null,
      current_queue_item_id: null,
      current_dj_user_id: null,
      started_at: null,
      is_paused: false,
      updated_at: new Date().toISOString(),
    });
    return { advanced: false, reason: "no_djs" };
  }

  const currentDjId = playback?.current_dj_user_id;
  const stayOnCurrentDj =
    options.stayOnCurrentDj ?? djSlots.length <= 1;
  let startIndex = 0;

  if (currentDjId) {
    const currentIndex = djSlots.findIndex((s) => s.user_id === currentDjId);
    if (currentIndex >= 0) {
      if (stayOnCurrentDj) {
        startIndex = currentIndex;
      } else {
        startIndex = (currentIndex + 1) % djSlots.length;

        const currentSlot = djSlots[currentIndex];
        await supabase
          .from("dj_slots")
          .update({ position: djSlots.length })
          .eq("id", currentSlot.id);

        for (let i = 0; i < djSlots.length; i++) {
          if (i !== currentIndex) {
            const newPos = i < currentIndex ? i : i;
            await supabase
              .from("dj_slots")
              .update({ position: newPos })
              .eq("id", djSlots[i].id);
          }
        }
      }
    } else if (
      options.afterDepartedDjPosition != null &&
      djSlots.length > 0
    ) {
      const nextIndex = djSlots.findIndex(
        (s) => s.position > options.afterDepartedDjPosition!
      );
      startIndex = nextIndex >= 0 ? nextIndex : 0;
    }
  }

  const { data: refreshedSlots } = await supabase
    .from("dj_slots")
    .select("*")
    .eq("room_id", roomId)
    .order("position");

  const slots = refreshedSlots || djSlots;
  let played = false;

  for (let attempt = 0; attempt < slots.length; attempt++) {
    const slotIndex = (startIndex + attempt) % slots.length;
    const slot = slots[slotIndex];

    const { data: queueItem } = await supabase
      .from("queue_items")
      .select("*, track:tracks(*)")
      .eq("room_id", roomId)
      .eq("dj_user_id", slot.user_id)
      .eq("status", "queued")
      .order("created_at")
      .limit(1)
      .maybeSingle();

    if (queueItem) {
      await supabase
        .from("queue_items")
        .update({ status: "playing" })
        .eq("id", queueItem.id);

      await supabase.from("room_playback").upsert({
        room_id: roomId,
        current_track_id: queueItem.track_id,
        current_queue_item_id: queueItem.id,
        current_dj_user_id: slot.user_id,
        started_at: new Date().toISOString(),
        is_paused: false,
        updated_at: new Date().toISOString(),
      });

      const trackTitle = queueItem.track?.title || "a track";
      const djName =
        (slot as { user?: { display_name?: string } }).user?.display_name ||
        "A DJ";
      await postSystemMessage(
        supabase,
        roomId,
        `🎵 Now playing: ${trackTitle}`
      );

      const { data: stats } = await supabase
        .from("user_stats")
        .select("tracks_played")
        .eq("user_id", slot.user_id)
        .single();

      if (stats) {
        await supabase
          .from("user_stats")
          .update({ tracks_played: stats.tracks_played + 1 })
          .eq("user_id", slot.user_id);
      }

      played = true;
      break;
    } else if (slots.length > 1) {
      await supabase
        .from("dj_slots")
        .update({ missed_turns: (slot.missed_turns || 0) + 1 })
        .eq("id", slot.id);

      const { data: djUser } = await supabase
        .from("users")
        .select("display_name")
        .eq("id", slot.user_id)
        .single();

      await postSystemMessage(
        supabase,
        roomId,
        `${djUser?.display_name || "A DJ"} had no track queued — skipping their turn.`
      );
    }
  }

  if (!played) {
    const sleepingDjId =
      currentDjId && slots.some((s) => s.user_id === currentDjId)
        ? currentDjId
        : slots[startIndex]?.user_id ?? slots[0]?.user_id ?? null;

    await supabase.from("room_playback").upsert({
      room_id: roomId,
      current_track_id: null,
      current_queue_item_id: null,
      current_dj_user_id: sleepingDjId,
      started_at: null,
      is_paused: false,
      updated_at: new Date().toISOString(),
    });

    // Rotate out DJs with 3+ missed turns if waitlist exists
    const { data: waitlist } = await supabase
      .from("dj_waitlist")
      .select("*")
      .eq("room_id", roomId)
      .order("position");

    if (waitlist && waitlist.length > 0) {
      const { data: inactiveSlots } = await supabase
        .from("dj_slots")
        .select("*")
        .eq("room_id", roomId)
        .gte("missed_turns", 3);

      for (const inactive of inactiveSlots || []) {
        const nextWaiter = waitlist[0];
        await supabase.from("dj_slots").delete().eq("id", inactive.id);
        await supabase.from("dj_waitlist").delete().eq("id", nextWaiter.id);

        const { data: currentSlots } = await supabase
          .from("dj_slots")
          .select("position")
          .eq("room_id", roomId)
          .order("position", { ascending: false })
          .limit(1);

        const newPosition = (currentSlots?.[0]?.position ?? -1) + 1;
        await supabase.from("dj_slots").insert({
          room_id: roomId,
          user_id: nextWaiter.user_id,
          position: newPosition,
        });

        const { data: waiter } = await supabase
          .from("users")
          .select("display_name")
          .eq("id", nextWaiter.user_id)
          .single();

        await postSystemMessage(
          supabase,
          roomId,
          `${waiter?.display_name || "Someone"} rotated into the booth from the waitlist.`
        );
      }
    }
  }

  return { advanced: played, reason };
}

export async function checkSkipThreshold(
  supabase: SupabaseClient,
  roomId: string,
  trackId: string
): Promise<boolean> {
  const { data: room } = await supabase
    .from("rooms")
    .select("lame_skip_percentage, lame_skip_minimum")
    .eq("id", roomId)
    .single();

  if (!room) return false;

  const { count: listenerCount } = await supabase
    .from("room_members")
    .select("*", { count: "exact", head: true })
    .eq("room_id", roomId)
    .gte("last_seen", new Date(Date.now() - 5 * 60 * 1000).toISOString());

  const { count: lameCount } = await supabase
    .from("track_votes")
    .select("*", { count: "exact", head: true })
    .eq("room_id", roomId)
    .eq("track_id", trackId)
    .eq("vote_type", "lame");

  const listeners = listenerCount || 1;
  const lames = lameCount || 0;
  const threshold = Math.max(
    room.lame_skip_minimum,
    Math.ceil(listeners * room.lame_skip_percentage)
  );

  return lames >= threshold;
}
