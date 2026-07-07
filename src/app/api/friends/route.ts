import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { listFriends } from "@/lib/friends";

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
    const friends = await listFriends(admin, user.id);
    return NextResponse.json(friends);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load friends";
    const missingTable =
      /relation .* does not exist|Could not find the table/i.test(message);
    if (missingTable) {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
