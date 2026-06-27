import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { postSystemMessage } from "@/lib/playback";
import { incrementUserStat } from "@/lib/user-stats";

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
    await incrementUserStat(
      admin,
      playback.current_dj_user_id,
      "tracks_saved_by_others"
    );
  }

  return NextResponse.json({ saved: true });
}
