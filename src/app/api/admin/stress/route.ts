import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  assertStressSecret,
  getActiveStressRun,
  startStressRun,
  stopStressRun,
} from "@/lib/stress-test";

function unauthorized() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function GET(request: Request) {
  if (!assertStressSecret(request)) return unauthorized();
  const admin = createServiceClient();
  const run = await getActiveStressRun(admin);
  if (!run) return NextResponse.json({ status: "idle" });
  return NextResponse.json({ status: "running", run });
}

export async function POST(request: Request) {
  if (!assertStressSecret(request)) return unauthorized();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const admin = createServiceClient();
  const result = await startStressRun(admin, body as Parameters<typeof startStressRun>[1]);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result, { status: 201 });
}

export async function DELETE(request: Request) {
  if (!assertStressSecret(request)) return unauthorized();
  const admin = createServiceClient();
  const result = await stopStressRun(admin, "stopped");
  if (result.ok === false) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json(result);
}
