import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserStats } from "@/lib/types";

export const BADGE = {
  DEEP_CUT_DEALER: "Deep Cut Dealer",
  MIDNIGHT_CURATOR: "Midnight Curator",
  VIBE_ASSASSIN: "Vibe Assassin",
  BLOGHOUSE_ARCHAEOLOGIST: "Bloghouse Archaeologist",
  NO_SKIP_MENACE: "No-Skip Menace",
  SAD_SONG_SOMMELIER: "Sad Song Sommelier",
  FIRST_SAVE: "First Save",
  CROWD_FAVORITE: "Crowd Favorite",
} as const;

export type BadgeName = (typeof BADGE)[keyof typeof BADGE];

const SAD_ROOM_KEYWORDS = ["sad", "melancholy", "melancholic", "somber", "grief"];

export function isMidnightHour(date = new Date()): boolean {
  const hour = date.getUTCHours();
  return hour >= 0 && hour < 5;
}

export function statBadgeEligibility(
  stats: Pick<
    UserStats,
    | "tracks_played"
    | "tracks_saved_by_others"
    | "awesome_votes_received"
    | "lame_votes_received"
  >
): BadgeName[] {
  const earned: BadgeName[] = [];
  const totalVotes =
    stats.awesome_votes_received + stats.lame_votes_received;

  if (stats.tracks_saved_by_others >= 1) {
    earned.push(BADGE.FIRST_SAVE);
  }

  if (stats.awesome_votes_received >= 10) {
    earned.push(BADGE.CROWD_FAVORITE);
  }

  if (
    totalVotes >= 10 &&
    stats.awesome_votes_received / totalVotes >= 0.8
  ) {
    earned.push(BADGE.VIBE_ASSASSIN);
  }

  if (stats.tracks_played >= 5 && stats.lame_votes_received === 0) {
    earned.push(BADGE.NO_SKIP_MENACE);
  }

  return earned;
}

export function roomHasTag(tags: string[] | null | undefined, tag: string): boolean {
  return (tags ?? []).some((t) => t.toLowerCase() === tag.toLowerCase());
}

export function isSadRoom(
  tags: string[] | null | undefined,
  vibe: string | null | undefined
): boolean {
  if (roomHasTag(tags, "sad")) return true;

  const haystack = `${vibe ?? ""}`.toLowerCase();
  return SAD_ROOM_KEYWORDS.some((word) => haystack.includes(word));
}

export async function awardBadge(
  supabase: SupabaseClient,
  userId: string,
  badgeName: BadgeName
): Promise<boolean> {
  const { data: badge } = await supabase
    .from("badges")
    .select("id")
    .eq("name", badgeName)
    .single();

  if (!badge) return false;

  const { error } = await supabase.from("user_badges").upsert(
    {
      user_id: userId,
      badge_id: badge.id,
    },
    { onConflict: "user_id,badge_id" }
  );

  return !error;
}

export async function awardStatBadges(
  supabase: SupabaseClient,
  userId: string,
  stats: Pick<
    UserStats,
    | "tracks_played"
    | "tracks_saved_by_others"
    | "awesome_votes_received"
    | "lame_votes_received"
  >
): Promise<void> {
  const eligible = statBadgeEligibility(stats);
  await Promise.all(
    eligible.map((name) => awardBadge(supabase, userId, name))
  );
}

export async function checkJoinBadges(
  supabase: SupabaseClient,
  userId: string,
  joinedAt = new Date()
): Promise<void> {
  if (isMidnightHour(joinedAt)) {
    await awardBadge(supabase, userId, BADGE.MIDNIGHT_CURATOR);
  }
}

export async function checkTrackPlayBadges(
  supabase: SupabaseClient,
  userId: string,
  trackId: string,
  room: { tags?: string[] | null; vibe?: string | null }
): Promise<void> {
  const { count: othersPlayed } = await supabase
    .from("queue_items")
    .select("*", { count: "exact", head: true })
    .eq("track_id", trackId)
    .neq("dj_user_id", userId)
    .in("status", ["played", "skipped"]);

  if ((othersPlayed ?? 0) === 0) {
    await awardBadge(supabase, userId, BADGE.DEEP_CUT_DEALER);
  }

  if (roomHasTag(room.tags, "bloghouse")) {
    await awardBadge(supabase, userId, BADGE.BLOGHOUSE_ARCHAEOLOGIST);
  }

  if (isSadRoom(room.tags, room.vibe)) {
    await awardBadge(supabase, userId, BADGE.SAD_SONG_SOMMELIER);
  }
}
