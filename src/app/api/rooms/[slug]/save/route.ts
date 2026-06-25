import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { postSystemMessage } from "@/lib/playback";

export async function POST(
  _request: Request,
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

  const admin = createServiceClient();
  const { data: room } = await admin
    .from("rooms")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const { data: playback } = await admin
    .from("room_playback")
    .select("current_track_id, current_dj_user_id")
    .eq("room_id", room.id)
    .single();

  if (!playback?.current_track_id) {
    return NextResponse.json({ error: "No track playing" }, { status: 400 });
  }

  const { error } = await admin.from("saved_tracks").upsert(
    {
      user_id: user.id,
      track_id: playback.current_track_id,
      room_id: room.id,
    },
    { onConflict: "user_id,track_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: profile } = await admin
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .single();

  await postSystemMessage(
    admin,
    room.id,
    `❤️ ${profile?.display_name || "Someone"} saved this track.`
  );

  if (playback.current_dj_user_id && playback.current_dj_user_id !== user.id) {
    const { data: stats } = await admin
      .from("user_stats")
      .select("tracks_saved_by_others")
      .eq("user_id", playback.current_dj_user_id)
      .single();

    if (stats) {
      await admin
        .from("user_stats")
        .update({ tracks_saved_by_others: stats.tracks_saved_by_others + 1 })
        .eq("user_id", playback.current_dj_user_id);
    }

    const { data: badge } = await admin
      .from("badges")
      .select("id")
      .eq("name", "First Save")
      .single();

    if (badge && stats?.tracks_saved_by_others === 0) {
      await admin.from("user_badges").upsert(
        {
          user_id: playback.current_dj_user_id,
          badge_id: badge.id,
        },
        { onConflict: "user_id,badge_id" }
      );
    }
  }

  return NextResponse.json({ saved: true });
}
