import type { SupabaseClient } from "@supabase/supabase-js";
import { postSystemMessage } from "@/lib/playback";
import { bumpRoomEnergy, ENERGY_BUMP } from "@/lib/room-energy";

export const PRESENCE_WINDOW_MS = 5 * 60 * 1000;

export function presenceCutoff(nowMs: number = Date.now()): string {
  return new Date(nowMs - PRESENCE_WINDOW_MS).toISOString();
}

export interface WaitlistCandidate {
  id: string;
  user_id: string;
  position: number;
}

export function isMemberPresent(
  lastSeen: string,
  nowMs: number = Date.now()
): boolean {
  return Date.parse(lastSeen) >= nowMs - PRESENCE_WINDOW_MS;
}

/** True when user must join waitlist instead of taking an open deck slot. */
export function shouldJoinWaitlist(
  slotCount: number,
  maxDjs: number,
  waitlistCount: number
): boolean {
  return waitlistCount > 0 || slotCount >= maxDjs;
}

export function pickNextWaitlistEntry(
  entries: WaitlistCandidate[],
  presentUserIds: Set<string>
): { promote: WaitlistCandidate | null; staleIds: string[] } {
  const sorted = [...entries].sort((a, b) => a.position - b.position);
  const staleIds: string[] = [];
  for (const entry of sorted) {
    if (presentUserIds.has(entry.user_id)) {
      return { promote: entry, staleIds };
    }
    staleIds.push(entry.id);
  }
  return { promote: null, staleIds };
}

export interface RemoveDjResult {
  wasOnDeck: boolean;
  wasWaitlisted: boolean;
  wasCurrentDj: boolean;
  wasPlaying: boolean;
  slotPosition: number | null;
}

export async function promoteFromWaitlist(
  supabase: SupabaseClient,
  roomId: string
): Promise<string | null> {
  const { data: waitlist } = await supabase
    .from("dj_waitlist")
    .select("id, user_id, position")
    .eq("room_id", roomId)
    .order("position");

  if (!waitlist?.length) return null;

  const userIds = waitlist.map((w) => w.user_id);
  const cutoff = presenceCutoff();
  const { data: members } = await supabase
    .from("room_members")
    .select("user_id, last_seen")
    .eq("room_id", roomId)
    .in("user_id", userIds)
    .gte("last_seen", cutoff);

  const presentIds = new Set((members ?? []).map((m) => m.user_id));
  const { promote, staleIds } = pickNextWaitlistEntry(waitlist, presentIds);

  if (staleIds.length) {
    await supabase.from("dj_waitlist").delete().in("id", staleIds);
  }

  if (!promote) {
    if (staleIds.length) {
      await postSystemMessage(
        supabase,
        roomId,
        "Waitlist cleared — the booth is open."
      );
    }
    return null;
  }

  const { data: slots } = await supabase
    .from("dj_slots")
    .select("position")
    .eq("room_id", roomId)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = (slots?.[0]?.position ?? -1) + 1;

  await supabase.from("dj_slots").insert({
    room_id: roomId,
    user_id: promote.user_id,
    position: nextPosition,
    missed_turns: 0,
  });

  await supabase
    .from("room_members")
    .upsert(
      { room_id: roomId, user_id: promote.user_id, role: "dj" },
      { onConflict: "room_id,user_id" }
    );

  await supabase.from("dj_waitlist").delete().eq("id", promote.id);

  const { data: user } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", promote.user_id)
    .single();

  await postSystemMessage(
    supabase,
    roomId,
    `${user?.display_name || "Someone"} rotated into the booth from the waitlist.`
  );

  await bumpRoomEnergy(supabase, roomId, ENERGY_BUMP.joinDeck);

  return promote.user_id;
}

export async function removeDjFromBooth(
  supabase: SupabaseClient,
  roomId: string,
  userId: string,
  options: { skipPromotion?: boolean } = {}
): Promise<RemoveDjResult> {
  const { data: leavingSlot } = await supabase
    .from("dj_slots")
    .select("id, position")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  const { data: waitlistEntry } = await supabase
    .from("dj_waitlist")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  const { data: playback } = await supabase
    .from("room_playback")
    .select("current_dj_user_id, current_track_id")
    .eq("room_id", roomId)
    .maybeSingle();

  const wasOnDeck = !!leavingSlot;
  const wasWaitlisted = !!waitlistEntry;
  const wasCurrentDj = playback?.current_dj_user_id === userId;
  const wasPlaying = wasCurrentDj && !!playback?.current_track_id;

  if (leavingSlot) {
    await supabase.from("dj_slots").delete().eq("id", leavingSlot.id);
  }

  if (waitlistEntry) {
    await supabase.from("dj_waitlist").delete().eq("id", waitlistEntry.id);
  }

  if (wasOnDeck) {
    await supabase
      .from("queue_items")
      .delete()
      .eq("room_id", roomId)
      .eq("dj_user_id", userId)
      .eq("status", "queued");

    await supabase
      .from("room_members")
      .update({ role: "listener" })
      .eq("room_id", roomId)
      .eq("user_id", userId);
  }

  if (wasOnDeck && !options.skipPromotion) {
    await promoteFromWaitlist(supabase, roomId);
  }

  return {
    wasOnDeck,
    wasWaitlisted,
    wasCurrentDj,
    wasPlaying,
    slotPosition: leavingSlot?.position ?? null,
  };
}

export type LeaveRoomReason = "voluntary" | "inactive";

export async function leaveRoomMember(
  supabase: SupabaseClient,
  roomId: string,
  userId: string,
  options: { reason?: LeaveRoomReason; displayName?: string } = {}
): Promise<RemoveDjResult> {
  const { reason = "voluntary", displayName: providedName } = options;

  let displayName = providedName;
  if (!displayName) {
    const { data: user } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", userId)
      .single();
    displayName = user?.display_name || "Someone";
  }

  const djResult = await removeDjFromBooth(supabase, roomId, userId);

  if (djResult.wasOnDeck) {
    const message =
      reason === "inactive"
        ? `${displayName} left the room (connection lost).`
        : djResult.wasPlaying
          ? `${displayName} left the room — track cut short.`
          : `${displayName} left the room.`;
    await postSystemMessage(supabase, roomId, message);
  }

  if (djResult.wasCurrentDj) {
    const { advancePlayback } = await import("@/lib/playback");
    await advancePlayback(
      supabase,
      roomId,
      djResult.wasPlaying ? "skipped" : "ended",
      { afterDepartedDjPosition: djResult.slotPosition ?? undefined }
    );
  }

  await supabase
    .from("room_members")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", userId);

  return djResult;
}

export async function processInactiveMembers(
  supabase: SupabaseClient,
  roomId: string
): Promise<number> {
  const cutoff = presenceCutoff();

  const { data: inactiveMembers } = await supabase
    .from("room_members")
    .select("user_id, user:users(display_name)")
    .eq("room_id", roomId)
    .lt("last_seen", cutoff);

  if (!inactiveMembers?.length) return 0;

  let removed = 0;
  for (const member of inactiveMembers) {
    const displayName =
      (member.user as { display_name?: string } | null)?.display_name ||
      "Someone";

    await leaveRoomMember(supabase, roomId, member.user_id, {
      reason: "inactive",
      displayName,
    });

    removed++;
  }

  return removed;
}

export async function processInactiveDjs(
  supabase: SupabaseClient,
  roomId: string
): Promise<number> {
  const { data: inactiveSlots } = await supabase
    .from("dj_slots")
    .select("user_id")
    .eq("room_id", roomId)
    .gte("missed_turns", 3);

  if (!inactiveSlots?.length) return 0;

  let removed = 0;
  for (const slot of inactiveSlots) {
    const { data: user } = await supabase
      .from("users")
      .select("display_name")
      .eq("id", slot.user_id)
      .single();

    await postSystemMessage(
      supabase,
      roomId,
      `${user?.display_name || "A DJ"} was removed from the booth after missing 3 turns.`
    );

    await removeDjFromBooth(supabase, roomId, slot.user_id);
    removed++;
  }

  return removed;
}
