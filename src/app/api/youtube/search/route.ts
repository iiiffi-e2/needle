import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchYouTubeVideos } from "@/lib/youtube";
import {
  checkSearchRateLimit,
  getCachedSearchResults,
  setCachedSearchResults,
} from "@/lib/youtube-search-cache";

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

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Search unavailable" },
      { status: 503 }
    );
  }

  const cached = getCachedSearchResults(query);
  if (cached) {
    return NextResponse.json({ results: cached, cached: true });
  }

  if (!checkSearchRateLimit(user.id)) {
    return NextResponse.json(
      { error: "Too many searches — wait a moment and try again" },
      { status: 429 }
    );
  }

  try {
    const results = await searchYouTubeVideos(query, apiKey);
    setCachedSearchResults(query, results);
    return NextResponse.json({ results, cached: false });
  } catch (err) {
    console.error("YouTube search error:", err);
    return NextResponse.json(
      { error: "Search unavailable — paste a link instead" },
      { status: 502 }
    );
  }
}
