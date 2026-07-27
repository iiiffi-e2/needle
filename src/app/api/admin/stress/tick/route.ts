import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { assertCronSecret, tickStressRun } from "@/lib/stress-test";

export async function POST(request: Request) {
  if (!assertCronSecret(request)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const admin = createServiceClient();
  const result = await tickStressRun(admin);
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}

// Vercel Cron sends GET by default for some configs — support both
export async function GET(request: Request) {
  return POST(request);
}
