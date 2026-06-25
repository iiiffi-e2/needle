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
    .select("id, max_djs")
    .eq("slug", slug)
    .single();

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const { data: existingSlot } = await admin
    .from("dj_slots")
    .select("id")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingSlot) {
    return NextResponse.json({ error: "Already in booth" }, { status: 400 });
  }

  const { count: slotCount } = await admin
    .from("dj_slots")
    .select("*", { count: "exact", head: true })
    .eq("room_id", room.id);

  const { data: profile } = await admin
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .single();

  if ((slotCount || 0) < room.max_djs) {
    const { data: slots } = await admin
      .from("dj_slots")
      .select("position")
      .eq("room_id", room.id)
      .order("position", { ascending: false })
      .limit(1);

    const nextPosition = (slots?.[0]?.position ?? -1) + 1;

    const { data: slot, error } = await admin
      .from("dj_slots")
      .insert({
        room_id: room.id,
        user_id: user.id,
        position: nextPosition,
      })
      .select("*, user:users(*)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await admin
      .from("room_members")
      .upsert(
        { room_id: room.id, user_id: user.id, role: "dj" },
        { onConflict: "room_id,user_id" }
      );

    await postSystemMessage(
      admin,
      room.id,
      `🎤 ${profile?.display_name || "Someone"} joined the booth.`
    );

    return NextResponse.json({ slot, waitlisted: false });
  }

  const { data: waitlist } = await admin
    .from("dj_waitlist")
    .select("position")
    .eq("room_id", room.id)
    .order("position", { ascending: false })
    .limit(1);

  const nextPosition = (waitlist?.[0]?.position ?? -1) + 1;

  const { data: entry, error } = await admin
    .from("dj_waitlist")
    .insert({
      room_id: room.id,
      user_id: user.id,
      position: nextPosition,
    })
    .select("*, user:users(*)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await postSystemMessage(
    admin,
    room.id,
    `${profile?.display_name || "Someone"} joined the DJ waitlist.`
  );

  return NextResponse.json({ entry, waitlisted: true });
}

export async function DELETE(
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

  await admin
    .from("dj_slots")
    .delete()
    .eq("room_id", room.id)
    .eq("user_id", user.id);

  await admin
    .from("dj_waitlist")
    .delete()
    .eq("room_id", room.id)
    .eq("user_id", user.id);

  await admin
    .from("queue_items")
    .delete()
    .eq("room_id", room.id)
    .eq("dj_user_id", user.id)
    .eq("status", "queued");

  const { data: profile } = await admin
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .single();

  await postSystemMessage(
    admin,
    room.id,
    `${profile?.display_name || "Someone"} left the booth.`
  );

  return NextResponse.json({ left: true });
}
