import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchYouTubeMetadata, youTubeWatchUrl } from "./youtube";
import type { Track } from "./types";

export async function findOrCreateYouTubeTrack(
  admin: SupabaseClient,
  videoId: string,
  submittedBy: string
): Promise<Track> {
  const { data: existing } = await admin
    .from("tracks")
    .select("*")
    .eq("provider", "youtube")
    .eq("provider_id", videoId)
    .maybeSingle();

  if (existing) {
    return existing as Track;
  }

  const metadata = await fetchYouTubeMetadata(videoId);

  const { data: created, error } = await admin
    .from("tracks")
    .insert({
      provider: "youtube",
      provider_id: videoId,
      url: youTubeWatchUrl(videoId),
      title: metadata.title,
      thumbnail_url: metadata.thumbnail_url,
      duration_seconds: metadata.duration_seconds,
      submitted_by: submittedBy,
    })
    .select()
    .single();

  if (error || !created) {
    throw new Error(error?.message ?? "Failed to create track");
  }

  return created as Track;
}
