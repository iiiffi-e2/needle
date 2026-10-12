import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { FriendRequestError, getRelationship, unfriend } from "@/lib/friends";
import { relationshipLookupGuard } from "@/lib/room-person";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const guard = relationshipLookupGuard(user?.id ?? null, userId);
  if (guard) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const admin = createServiceClient();
  try {
    const relationship = await getRelationship(admin, user!.id, userId);
    return NextResponse.json({ relationship });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const admin = createServiceClient();
  try {
    await unfriend(admin, user.id, userId);
    return NextResponse.json({ unfriended: true });
  } catch (error) {
    if (error instanceof FriendRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
