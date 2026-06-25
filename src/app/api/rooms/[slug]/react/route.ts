import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { bumpRoomEnergy, ENERGY_BUMP } from "@/lib/room-energy";

const REACT_BUMPS: Record<string, number> = {
  heart: ENERGY_BUMP.react,
  star: ENERGY_BUMP.react,
  note: ENERGY_BUMP.react,
  fire: ENERGY_BUMP.reactFire,
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type } = await request.json();
  const bump = REACT_BUMPS[type] ?? ENERGY_BUMP.react;

  const admin = createServiceClient();
  const { data: room } = await admin
    .from("rooms")
    .select("id")
    .eq("slug", slug)
    .single();

  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const energy = await bumpRoomEnergy(admin, room.id, bump);
  return NextResponse.json({ reacted: true, energy });
}
