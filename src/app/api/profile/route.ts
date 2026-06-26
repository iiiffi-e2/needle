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

  const profileFields = "id, display_name, avatar_color, avatar_url, created_at";

  const { data: updated, error: updateError } = await supabase
    .from("users")
    .update(updates)
    .eq("id", user.id)
    .select(profileFields)
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (updated) {
    return NextResponse.json(updated);
  }

  const displayName =
    (typeof user.user_metadata?.display_name === "string" &&
      user.user_metadata.display_name.trim()) ||
    user.email?.split("@")[0] ||
    "User";

  const { data: inserted, error: insertError } = await supabase
    .from("users")
    .insert({
      id: user.id,
      email: user.email ?? null,
      display_name: displayName,
      ...updates,
    })
    .select(profileFields)
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(inserted);
}
