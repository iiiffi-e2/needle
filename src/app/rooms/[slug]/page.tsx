import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { RoomClient } from "@/components/room/RoomClient";
import { postSystemMessage } from "@/lib/playback";
import { bumpRoomEnergy, ENERGY_BUMP, syncRoomEnergyDecay } from "@/lib/room-energy";
import { presenceCutoff, processInactiveMembers } from "@/lib/dj-booth";

interface RoomPageProps {
  params: Promise<{ slug: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth/login?redirect=/rooms/${slug}`);
  }

  const admin = createServiceClient();
  const { data: room } = await admin
    .from("rooms")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!room) {
    notFound();
  }

  const { data: existingMember } = await admin
    .from("room_members")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existingMember) {
    const { data: profile } = await admin
      .from("users")
      .select("display_name")
      .eq("id", user.id)
      .single();

    await admin.from("room_members").insert({
      room_id: room.id,
      user_id: user.id,
      role: "listener",
      last_seen: new Date().toISOString(),
    });

    await postSystemMessage(
      admin,
      room.id,
      `${profile?.display_name || "Someone"} joined the room.`
    );

    await bumpRoomEnergy(admin, room.id, ENERGY_BUMP.joinRoom);
  } else {
    await admin
      .from("room_members")
      .update({ last_seen: new Date().toISOString() })
      .eq("room_id", room.id)
      .eq("user_id", user.id);
  }

  await processInactiveMembers(admin, room.id);

  const [
    { data: playback },
    { data: members },
    { data: djSlots },
    { data: waitlist },
    { data: queueItems },
    { data: messages },
  ] = await Promise.all([
    admin
      .from("room_playback")
      .select(
        "*, track:tracks(*, submitter:users!tracks_submitted_by_fkey(*)), dj:users!room_playback_current_dj_user_id_fkey(*)"
      )
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
    admin
      .from("chat_messages")
      .select("*, user:users(*)")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })
      .limit(50),
  ]);

  let votes = { awesome: 0, lame: 0 };
  let userVotes: string[] = [];
  let userSaved = false;

  if (playback?.current_track_id) {
    const { data: voteData } = await admin
      .from("track_votes")
      .select("vote_type, user_id")
      .eq("room_id", room.id)
      .eq("track_id", playback.current_track_id);

    votes = {
      awesome: voteData?.filter((v) => v.vote_type === "awesome").length || 0,
      lame: voteData?.filter((v) => v.vote_type === "lame").length || 0,
    };

    userVotes =
      voteData
        ?.filter((v) => v.user_id === user.id)
        .map((v) => v.vote_type) || [];

    const { data: saved } = await admin
      .from("saved_tracks")
      .select("id")
      .eq("user_id", user.id)
      .eq("track_id", playback.current_track_id)
      .maybeSingle();

    userSaved = !!saved;
  }

  const { energy: roomEnergy, updatedAt: energyUpdatedAt } =
    await syncRoomEnergyDecay(admin, room.id);

  return (
    <RoomClient
      room={{ ...room, room_energy: roomEnergy, room_energy_updated_at: energyUpdatedAt }}
      initialData={{
        playback: playback || null,
        members: members || [],
        djSlots: djSlots || [],
        waitlist: waitlist || [],
        queueItems: queueItems || [],
        votes,
        userVotes,
        userSaved,
        currentUserId: user.id,
        messages: messages || [],
        energy: roomEnergy,
        energyUpdatedAt,
      }}
    />
  );
}
