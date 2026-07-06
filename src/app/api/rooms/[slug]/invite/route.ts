import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { FriendRequestError, sendRoomInvite } from "@/lib/friends";

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

  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const toUserId = body.userId?.trim();
  if (!toUserId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const admin = createServiceClient();
  const { data: room, error: roomError } = await admin
    .from("rooms")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (roomError) {
    return NextResponse.json({ error: roomError.message }, { status: 500 });
  }
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  try {
    const invite = await sendRoomInvite(admin, user.id, toUserId, room.id);
    return NextResponse.json(invite);
  } catch (error) {
    if (error instanceof FriendRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
