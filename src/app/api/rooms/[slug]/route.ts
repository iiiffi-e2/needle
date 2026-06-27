import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { postSystemMessage } from "@/lib/playback";
import { generateNeedlebotMessage, shouldNeedlebotSpeak } from "@/lib/needlebot";
import { bumpRoomEnergy, ENERGY_BUMP, syncRoomEnergyDecay } from "@/lib/room-energy";
import { presenceCutoff, processInactiveMembers } from "@/lib/dj-booth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const admin = createServiceClient();

  const { data: room, error } = await admin
    .from("rooms")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const { energy: roomEnergy, updatedAt: energyUpdatedAt } =
    await syncRoomEnergyDecay(admin, room.id);

  await processInactiveMembers(admin, room.id);

  const [
    { data: playback },
    { data: members },
    { data: djSlots },
    { data: waitlist },
    { data: queueItems },
  ] = await Promise.all([
    admin
      .from("room_playback")
      .select("*, track:tracks(*, submitter:users!tracks_submitted_by_fkey(*)), dj:users!room_playback_current_dj_user_id_fkey(*)")
      .eq("room_id", room.id)
      .maybeSingle(),
    admin
      .from("room_members")
      .select("*, user:users(*)")
      .eq("room_id", room.id)
      .gte("last_seen", presenceCutoff())
      .order("joined_at"),
    admin
      .from("dj_slots")
      .select("*, user:users(*)")
      .eq("room_id", room.id)
      .order("position"),
    admin
      .from("dj_waitlist")
      .select("*, user:users(*)")
      .eq("room_id", room.id)
      .order("position"),
    admin
      .from("queue_items")
      .select("*, track:tracks(*), dj:users!queue_items_dj_user_id_fkey(*)")
      .eq("room_id", room.id)
      .eq("status", "queued")
      .order("created_at"),
  ]);

  let votes = { awesome: 0, lame: 0 };
  let userVotes: string[] = [];
  let userSaved = false;

  if (playback?.current_track_id) {
    const { data: voteData } = await admin
      .from("track_votes")
      .select("vote_type")
      .eq("room_id", room.id)
      .eq("track_id", playback.current_track_id);

    votes = {
      awesome: voteData?.filter((v) => v.vote_type === "awesome").length || 0,
      lame: voteData?.filter((v) => v.vote_type === "lame").length || 0,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && playback?.current_track_id) {
    const { data: myVotes } = await admin
      .from("track_votes")
      .select("vote_type")
      .eq("room_id", room.id)
      .eq("track_id", playback.current_track_id)
      .eq("user_id", user.id);

    userVotes = myVotes?.map((v) => v.vote_type) || [];

    const { data: saved } = await admin
      .from("saved_tracks")
      .select("id")
      .eq("user_id", user.id)
      .eq("track_id", playback.current_track_id)
      .maybeSingle();

    userSaved = !!saved;
  }

  return NextResponse.json({
    room: {
      ...room,
      room_energy: roomEnergy,
      room_energy_updated_at: energyUpdatedAt,
    },
    playback,
    members: members || [],
    djSlots: djSlots || [],
    waitlist: waitlist || [],
    queueItems: queueItems || [],
    votes,
    userVotes,
    userSaved,
    currentUserId: user?.id || null,
  });
}

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

  const admin = createServiceClient();
  const { data: room } = await admin
    .from("rooms")
    .select("id, name, vibe")
    .eq("slug", slug)
    .single();

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const { data: profile } = await admin
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .single();

  await admin.from("room_members").upsert(
    {
      room_id: room.id,
      user_id: user.id,
      role: "listener",
      last_seen: new Date().toISOString(),
    },
    { onConflict: "room_id,user_id" }
  );

  await bumpRoomEnergy(admin, room.id, ENERGY_BUMP.joinRoom);

  await postSystemMessage(
    admin,
    room.id,
    `${profile?.display_name || "Someone"} joined the room.`
  );

  if (shouldNeedlebotSpeak()) {
    const { data: recentMessages } = await admin
      .from("chat_messages")
      .select("body")
      .eq("room_id", room.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const { count: listenerCount } = await admin
      .from("room_members")
      .select("*", { count: "exact", head: true })
      .eq("room_id", room.id);

    const message = await generateNeedlebotMessage({
      roomName: room.name,
      vibe: room.vibe,
      recentTracks: [],
      recentChat: recentMessages?.map((m) => m.body) || [],
      listenerCount: listenerCount || 1,
      awesomeCount: 0,
      lameCount: 0,
      newUserName: profile?.display_name || undefined,
    });

    await postSystemMessage(admin, room.id, `🤖 Needlebot: ${message}`);
  }

  return NextResponse.json({ joined: true });
}
