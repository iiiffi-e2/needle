import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { parseYouTubeUrl } from "@/lib/youtube";
import { findOrCreateYouTubeTrack } from "@/lib/find-or-create-youtube-track";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { url, videoId: rawVideoId } = body as {
    url?: string;
    videoId?: string;
  };

  const videoId =
    rawVideoId?.trim() || (url ? parseYouTubeUrl(url) : null);

  if (!videoId) {
    return NextResponse.json(
      { error: "Provide a valid YouTube URL or video ID" },
      { status: 400 }
    );
  }

  const admin = createServiceClient();

  let track;
  try {
    track = await findOrCreateYouTubeTrack(admin, videoId, user.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save track";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { data: existingSave } = await admin
    .from("saved_tracks")
    .select("id")
    .eq("user_id", user.id)
    .eq("track_id", track.id)
    .maybeSingle();

  const { error: saveError } = await admin.from("saved_tracks").upsert(
    {
      user_id: user.id,
      track_id: track.id,
      room_id: null,
    },
    { onConflict: "user_id,track_id" }
  );

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  return NextResponse.json({
    saved: true,
    trackId: track.id,
    alreadySaved: Boolean(existingSave),
  });
}
