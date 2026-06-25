import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  advancePlayback,
  checkSkipThreshold,
  postSystemMessage,
} from "@/lib/playback";
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

  const trackId = playback.current_track_id;

  const { data: existingVotes } = await admin
    .from("track_votes")
    .select("vote_type")
    .eq("room_id", room.id)
    .eq("track_id", trackId)
    .eq("user_id", user.id);

  const hadSame = existingVotes?.some((v) => v.vote_type === voteType);
  const hadOther = existingVotes?.find((v) => v.vote_type !== voteType);

  if (hadSame) {
    await admin
      .from("track_votes")
      .delete()
      .eq("room_id", room.id)
      .eq("track_id", trackId)
      .eq("user_id", user.id)
      .eq("vote_type", voteType);

    const reverse =
      voteType === "awesome" ? -ENERGY_BUMP.awesomeVote : -ENERGY_BUMP.lameVote;
    await bumpRoomEnergy(admin, room.id, reverse);

    return NextResponse.json({ removed: true, voteType: null, skipped: false });
  }

  if (hadOther) {
    await admin
      .from("track_votes")
      .delete()
      .eq("room_id", room.id)
      .eq("track_id", trackId)
      .eq("user_id", user.id)
      .eq("vote_type", hadOther.vote_type);

    const reverseOther =
      hadOther.vote_type === "awesome"
        ? -ENERGY_BUMP.awesomeVote
        : -ENERGY_BUMP.lameVote;
    await bumpRoomEnergy(admin, room.id, reverseOther);
  }

  const { error } = await admin.from("track_votes").insert({
    room_id: room.id,
    track_id: trackId,
    user_id: user.id,
    vote_type: voteType,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const bump =
    voteType === "awesome" ? ENERGY_BUMP.awesomeVote : ENERGY_BUMP.lameVote;
  await bumpRoomEnergy(admin, room.id, bump);

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
    const shouldSkip = await checkSkipThreshold(admin, room.id, trackId);

    if (shouldSkip) {
      await postSystemMessage(
        admin,
        room.id,
        "The room lamed this song into the shadow realm. ⏭️"
      );
      await advancePlayback(admin, room.id, "skipped");
      return NextResponse.json({
        voted: true,
        voteType,
        skipped: true,
        removed: false,
      });
    }
  }

  return NextResponse.json({
    voted: true,
    voteType,
    skipped: false,
    removed: false,
  });
}
