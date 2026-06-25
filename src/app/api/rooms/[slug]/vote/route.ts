import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  advancePlayback,
  checkSkipThreshold,
  postSystemMessage,
} from "@/lib/playback";

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

  const { voteType } = await request.json();
  if (!["awesome", "lame"].includes(voteType)) {
    return NextResponse.json({ error: "Invalid vote type" }, { status: 400 });
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

  const { error } = await admin.from("track_votes").upsert(
    {
      room_id: room.id,
      track_id: playback.current_track_id,
      user_id: user.id,
      vote_type: voteType,
    },
    { onConflict: "room_id,track_id,user_id,vote_type" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (playback.current_dj_user_id) {
    const statField =
      voteType === "awesome"
        ? "awesome_votes_received"
        : "lame_votes_received";

    const { data: stats } = await admin
      .from("user_stats")
      .select(statField)
      .eq("user_id", playback.current_dj_user_id)
      .single();

    if (stats) {
      await admin
        .from("user_stats")
        .update({
          [statField]: (stats[statField as keyof typeof stats] as number) + 1,
        })
        .eq("user_id", playback.current_dj_user_id);
    }
  }

  if (voteType === "lame") {
    const shouldSkip = await checkSkipThreshold(
      admin,
      room.id,
      playback.current_track_id
    );

    if (shouldSkip) {
      await postSystemMessage(
        admin,
        room.id,
        "The room lamed this song into the shadow realm. ⏭️"
      );
      await advancePlayback(admin, room.id, "skipped");
      return NextResponse.json({ voted: true, skipped: true });
    }
  }

  return NextResponse.json({ voted: true, skipped: false });
}
