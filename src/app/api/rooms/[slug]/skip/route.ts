import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { advancePlayback, postSystemMessage } from "@/lib/playback";

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

  if (playback.current_dj_user_id !== user.id) {
    return NextResponse.json(
      { error: "Only the current DJ can skip" },
      { status: 403 }
    );
  }

  const { data: profile } = await admin
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .single();

  await postSystemMessage(
    admin,
    room.id,
    `⏭️ ${profile?.display_name || "The DJ"} skipped their track.`
  );

  const result = await advancePlayback(admin, room.id, "skipped");

  return NextResponse.json(result);
}
