import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const admin = createServiceClient();

  const { data: user, error } = await admin
    .from("users")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [
    { data: stats },
    { data: savedTracks },
    { data: badges },
  ] = await Promise.all([
    admin.from("user_stats").select("*").eq("user_id", id).single(),
    admin
      .from("saved_tracks")
      .select("*, track:tracks(*)")
      .eq("user_id", id)
      .order("saved_at", { ascending: false })
      .limit(20),
    admin
      .from("user_badges")
      .select("*, badge:badges(*)")
      .eq("user_id", id),
  ]);

  const awesomeRatio =
    stats && stats.awesome_votes_received + stats.lame_votes_received > 0
      ? Math.round(
          (stats.awesome_votes_received /
            (stats.awesome_votes_received + stats.lame_votes_received)) *
            100
        )
      : null;

  return NextResponse.json({
    user,
    stats: stats || {
      tracks_played: 0,
      tracks_saved_by_others: 0,
      awesome_votes_received: 0,
      lame_votes_received: 0,
      rooms_joined: 0,
    },
    savedTracks: savedTracks || [],
    badges: badges || [],
    awesomeRatio,
  });
}
