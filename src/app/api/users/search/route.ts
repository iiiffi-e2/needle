import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { getRelationshipHint } from "@/lib/friends";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  const admin = createServiceClient();
  const { data: users, error: usersError } = await admin
    .from("users")
    .select("id, display_name, avatar_url, avatar_color, created_at, email")
    .ilike("display_name", `%${query}%`)
    .neq("id", user.id)
    .order("display_name", { ascending: true })
    .limit(20);

  if (usersError) {
    return NextResponse.json({ error: usersError.message }, { status: 500 });
  }

  if (!users?.length) {
    return NextResponse.json([]);
  }

  const { data: relationships, error: relationshipsError } = await admin
    .from("relationships")
    .select("user_a_id, user_b_id, status, requested_by")
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`);

  if (relationshipsError) {
    return NextResponse.json({ error: relationshipsError.message }, { status: 500 });
  }

  const relationshipByUserId = new Map<
    string,
    { status: "pending" | "accepted" | "declined" | "blocked"; requested_by: string }
  >();

  for (const relationship of relationships ?? []) {
    const otherUserId =
      relationship.user_a_id === user.id
        ? relationship.user_b_id
        : relationship.user_a_id;
    relationshipByUserId.set(otherUserId, relationship);
  }

  const results = users
    .map((candidate) => {
      const relationship = relationshipByUserId.get(candidate.id) ?? null;
      const relationshipHint = getRelationshipHint(relationship, user.id);
      return {
        ...candidate,
        relationshipHint,
      };
    })
    .filter((candidate) => candidate.relationshipHint !== "blocked_by_them");

  return NextResponse.json(results);
}
