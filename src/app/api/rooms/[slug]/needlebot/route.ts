import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { postSystemMessage } from "@/lib/playback";
import { generateNeedlebotMessage } from "@/lib/needlebot";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const admin = createServiceClient();

  const { data: room } = await admin
    .from("rooms")
    .select("id, name, vibe")
    .eq("slug", slug)
    .single();

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const { data: playback } = await admin
    .from("room_playback")
    .select("current_track_id")
    .eq("room_id", room.id)
    .single();

  const { data: recentTracks } = await admin
    .from("queue_items")
    .select("track:tracks(title)")
    .eq("room_id", room.id)
    .in("status", ["played", "skipped"])
    .order("played_at", { ascending: false })
    .limit(5);

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

  let awesomeCount = 0;
  let lameCount = 0;

  if (playback?.current_track_id) {
    const { data: votes } = await admin
      .from("track_votes")
      .select("vote_type")
      .eq("room_id", room.id)
      .eq("track_id", playback.current_track_id);

    awesomeCount = votes?.filter((v) => v.vote_type === "awesome").length || 0;
    lameCount = votes?.filter((v) => v.vote_type === "lame").length || 0;
  }

  const message = await generateNeedlebotMessage({
    roomName: room.name,
    vibe: room.vibe,
    recentTracks:
      recentTracks
        ?.map((t) => {
          const track = t.track as unknown as { title: string } | null;
          return track?.title;
        })
        .filter((title): title is string => Boolean(title)) || [],
    recentChat: recentMessages?.map((m) => m.body) || [],
    listenerCount: listenerCount || 1,
    awesomeCount,
    lameCount,
  });

  await postSystemMessage(admin, room.id, `🤖 Needlebot: ${message}`);

  return NextResponse.json({ message });
}
