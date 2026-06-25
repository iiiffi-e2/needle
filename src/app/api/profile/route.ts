import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CROWD_COLORS } from "@/lib/design-tokens";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { avatar_color?: string; display_name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, string> = {};

  if (body.avatar_color !== undefined) {
    if (
      typeof body.avatar_color !== "string" ||
      !(CROWD_COLORS as readonly string[]).includes(body.avatar_color)
    ) {
      return NextResponse.json({ error: "Invalid color" }, { status: 400 });
    }
    updates.avatar_color = body.avatar_color;
  }

  if (body.display_name !== undefined) {
    const name = body.display_name.trim();
    if (!name) {
      return NextResponse.json({ error: "Display name required" }, { status: 400 });
    }
    updates.display_name = name;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("users")
    .update(updates)
    .eq("id", user.id)
    .select("id, display_name, avatar_color, avatar_url, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
