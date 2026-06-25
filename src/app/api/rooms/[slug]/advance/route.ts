import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { advancePlayback } from "@/lib/playback";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const body = await request.json().catch(() => ({ reason: "ended" }));
  const reason = body.reason === "skipped" ? "skipped" : "ended";
  const queueItemId = body.queueItemId as string | undefined;

  const admin = createServiceClient();
  const { data: room } = await admin
    .from("rooms")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  if (queueItemId) {
    const { data: playback } = await admin
      .from("room_playback")
      .select("current_queue_item_id")
      .eq("room_id", room.id)
      .maybeSingle();

    if (playback?.current_queue_item_id !== queueItemId) {
      return NextResponse.json({
        advanced: false,
        reason: "already_advanced",
      });
    }
  }

  const result = await advancePlayback(admin, room.id, reason);

  return NextResponse.json(result);
}
