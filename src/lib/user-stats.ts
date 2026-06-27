import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserStats } from "@/lib/types";
import { awardStatBadges } from "@/lib/badges";

type StatField = keyof Pick<
  UserStats,
  | "tracks_played"
  | "tracks_saved_by_others"
  | "awesome_votes_received"
  | "lame_votes_received"
  | "rooms_joined"
>;

export async function incrementUserStat(
  supabase: SupabaseClient,
  userId: string,
  field: StatField,
  delta = 1
): Promise<UserStats | null> {
  const { data: stats } = await supabase
    .from("user_stats")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!stats) return null;

  const next = {
    ...stats,
    [field]: (stats[field] as number) + delta,
  };

  const { data: updated } = await supabase
    .from("user_stats")
    .update({ [field]: next[field] })
    .eq("user_id", userId)
    .select("*")
    .single();

  if (updated) {
    await awardStatBadges(supabase, userId, updated);
  }

  return updated;
}

export async function recordFirstRoomJoin(
  supabase: SupabaseClient,
  userId: string,
  roomId: string
): Promise<boolean> {
  const { data: existing } = await supabase
    .from("room_members")
    .select("id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return false;

  await incrementUserStat(supabase, userId, "rooms_joined");
  return true;
}
