import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { listPendingRequests } from "@/lib/friends";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceClient();

  try {
    const pending = await listPendingRequests(admin, user.id);
    return NextResponse.json(pending);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load friend requests";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
