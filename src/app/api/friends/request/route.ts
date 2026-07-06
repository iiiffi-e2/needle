import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { FriendRequestError, sendFriendRequest } from "@/lib/friends";

export async function POST(request: Request) {
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
  try {
    const relationship = await sendFriendRequest(admin, user.id, toUserId);
    return NextResponse.json(relationship);
  } catch (error) {
    if (error instanceof FriendRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
