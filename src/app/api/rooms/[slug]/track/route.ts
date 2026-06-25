import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { parseYouTubeUrl, fetchYouTubeMetadata } from "@/lib/youtube";
import { postSystemMessage } from "@/lib/playback";
import { bumpRoomEnergy, ENERGY_BUMP } from "@/lib/room-energy";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url } = await request.json();
  const videoId = parseYouTubeUrl(url);

  if (!videoId) {
    return NextResponse.json(
      { error: "Invalid YouTube URL" },
      { status: 400 }
    );
  }

  const admin = createServiceClient();
  const { data: room } = await admin
    .from("rooms")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const { data: djSlot } = await admin
    .from("dj_slots")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!djSlot) {
    return NextResponse.json(
      { error: "You must be in the DJ booth to add tracks" },
      { status: 403 }
    );
  }

  const metadata = await fetchYouTubeMetadata(videoId);

  const { data: track, error: trackError } = await admin
    .from("tracks")
    .insert({
      provider: "youtube",
      provider_id: videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title: metadata.title,
      thumbnail_url: metadata.thumbnail_url,
      duration_seconds: metadata.duration_seconds,
      submitted_by: user.id,
    })
    .select()
    .single();

  if (trackError) {
    return NextResponse.json({ error: trackError.message }, { status: 500 });
  }

  const { data: queueItem, error: queueError } = await admin
    .from("queue_items")
    .insert({
      room_id: room.id,
      dj_user_id: user.id,
      track_id: track.id,
      status: "queued",
    })
    .select("*, track:tracks(*)")
    .single();

  if (queueError) {
    return NextResponse.json({ error: queueError.message }, { status: 500 });
  }

  const { data: profile } = await admin
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .single();

  await postSystemMessage(
    admin,
    room.id,
    `🎧 ${profile?.display_name || "A DJ"} dropped a track: ${track.title}`
  );

  await bumpRoomEnergy(admin, room.id, ENERGY_BUMP.dropTrack);

  // Reset missed turns when adding a track
  await admin
    .from("dj_slots")
    .update({ missed_turns: 0 })
    .eq("room_id", room.id)
    .eq("user_id", user.id);

  // If nothing is playing, start playback
  const { data: playback } = await admin
    .from("room_playback")
    .select("current_track_id")
    .eq("room_id", room.id)
    .single();

  if (!playback?.current_track_id) {
    const { advancePlayback } = await import("@/lib/playback");
    await advancePlayback(admin, room.id, "ended");
  }

  return NextResponse.json(queueItem);
}
