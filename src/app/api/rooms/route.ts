import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils";

const EXAMPLE_ROOMS = [
  {
    name: "Late Night Indie Funeral",
    vibe: "Sad bangers for people who still believe in choruses",
    tags: ["indie", "sad", "late-night"],
    description: "Where every song feels like the last one at the party.",
  },
  {
    name: "Coding in the Dark",
    vibe: "Focus beats with occasional chaos",
    tags: ["electronic", "focus", "ambient"],
    description: "Lo-fi for the terminally online.",
  },
  {
    name: "Texas Porch Beers",
    vibe: "Country-adjacent, beer-optional",
    tags: ["country", "americana", "chill"],
    description: "Sunset optional. Good company required.",
  },
  {
    name: "2009 Bloghouse Emergency",
    vibe: "Neon nostalgia and questionable decisions",
    tags: ["bloghouse", "electro", "nostalgia"],
    description: "Justice remixes and skinny jeans energy.",
  },
  {
    name: "Sad Dad Airport Lounge",
    vibe: "Melancholy for the in-between",
    tags: ["sad", "dad-rock", "ambient"],
    description: "Delayed flights and emotional baggage.",
  },
  {
    name: "Synths & Bad Decisions",
    vibe: "Synthesizers and regret",
    tags: ["synth", "electronic", "night"],
    description: "Every synth line is a confession.",
  },
];

export async function GET() {
  const supabase = await createClient();
  const admin = createServiceClient();

  const { data: rooms, error } = await admin
    .from("rooms")
    .select("*")
    .eq("is_private", false)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const roomsWithStats = await Promise.all(
    (rooms || []).map(async (room) => {
      const { count: listenerCount } = await admin
        .from("room_members")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room.id)
        .gte(
          "last_seen",
          new Date(Date.now() - 5 * 60 * 1000).toISOString()
        );

      const { count: djCount } = await admin
        .from("dj_slots")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room.id);

      const { data: playback } = await admin
        .from("room_playback")
        .select("*, track:tracks(*)")
        .eq("room_id", room.id)
        .maybeSingle();

      return {
        ...room,
        listener_count: listenerCount || 0,
        dj_count: djCount || 0,
        current_track: playback?.track || null,
      };
    })
  );

  return NextResponse.json(roomsWithStats);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, description, vibe, tags } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const admin = createServiceClient();
  let slug = slugify(name);
  const { data: existing } = await admin
    .from("rooms")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const { data: room, error } = await admin
    .from("rooms")
    .insert({
      name: name.trim(),
      slug,
      description: description?.trim() || null,
      vibe: vibe?.trim() || null,
      tags: tags || [],
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await admin.from("room_playback").insert({ room_id: room.id });

  return NextResponse.json(room);
}

export async function PUT() {
  const admin = createServiceClient();
  const {
    data: { users },
  } = await admin.auth.admin.listUsers({ perPage: 1 });

  const systemUserId = users?.[0]?.id;
  if (!systemUserId) {
    return NextResponse.json(
      { error: "No users exist. Sign up first, then seed." },
      { status: 400 }
    );
  }

  const created = [];

  for (const example of EXAMPLE_ROOMS) {
    const slug = slugify(example.name);
    const { data: existing } = await admin
      .from("rooms")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) continue;

    const { data: room } = await admin
      .from("rooms")
      .insert({
        ...example,
        slug,
        created_by: systemUserId,
      })
      .select()
      .single();

    if (room) {
      await admin.from("room_playback").insert({ room_id: room.id });
      created.push(room);
    }
  }

  return NextResponse.json({ created });
}
