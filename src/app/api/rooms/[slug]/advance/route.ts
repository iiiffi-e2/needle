import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { advancePlayback } from "@/lib/playback";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const { reason } = await request.json().catch(() => ({ reason: "ended" }));

  const admin = createServiceClient();
  const { data: room } = await admin
    .from("rooms")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const result = await advancePlayback(
    admin,
    room.id,
    reason === "skipped" ? "skipped" : "ended"
  );

  return NextResponse.json(result);
}
