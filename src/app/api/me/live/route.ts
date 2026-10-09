import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { presenceCutoff } from "@/lib/dj-booth";
import { listFriends } from "@/lib/friends";
import { friendsOnTheFloor, yourLiveRooms } from "@/lib/floor-return";
import { partitionRooms } from "@/lib/room-liveness";
import type { FriendWithPresence } from "@/lib/types";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceClient();

  const { data: rooms, error } = await admin
    .from("rooms")
    .select("*")
    .eq("is_private", false)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const roomsWithStats = await Promise.all(
    (rooms || []).map(async (room) => {
      const { count: listenerCount } = await admin
        .from("room_members")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room.id)
        .gte("last_seen", presenceCutoff());

      const { count: djCount } = await admin
        .from("dj_slots")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room.id);

      const { data: playback } = await admin
        .from("room_playback")
        .select(
          "*, track:tracks(*), dj:users!room_playback_current_dj_user_id_fkey(display_name)"
        )
        .eq("room_id", room.id)
        .maybeSingle();

      return {
        ...room,
        listener_count: listenerCount || 0,
        dj_count: djCount || 0,
        current_track: playback?.track || null,
        current_dj: playback?.dj ?? null,
      };
    })
  );

  const spinning = partitionRooms(roomsWithStats).spinning;

  const { data: membershipRows, error: membershipError } = await admin
    .from("room_members")
    .select("room_id, last_seen")
    .eq("user_id", user.id);

  if (membershipError) {
    return NextResponse.json({ error: membershipError.message }, { status: 500 });
  }

  const yourLive = yourLiveRooms(
    spinning,
    (membershipRows ?? []).map((row) => ({
      roomId: row.room_id,
      lastSeen: row.last_seen,
    })),
    Date.now()
  );

  let friends: FriendWithPresence[] = [];
  try {
    friends = friendsOnTheFloor(await listFriends(admin, user.id));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load friends";
    const missingTable =
      /relation .* does not exist|Could not find the table/i.test(message);
    if (!missingTable) {
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  return NextResponse.json({
    friends,
    yourRooms: yourLive.map((room) => ({
      id: room.id,
      name: room.name,
      slug: room.slug,
    })),
  });
}
