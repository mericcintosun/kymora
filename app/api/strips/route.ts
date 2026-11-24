import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/adapter";
import type { ApiResponse, StripSummary } from "@/lib/types";

// The seeded list is fixed at build time. No input, no file system access.
export const dynamic = "force-static";

export function GET() {
  const adapter = getAdapter();
  try {
    const body: ApiResponse<StripSummary[]> = { ok: true, data: adapter.listSummaries(), mode: adapter.mode };
    return NextResponse.json(body);
  } catch (e) {
    const body: ApiResponse<StripSummary[]> = { ok: false, error: e instanceof Error ? e.message : "Could not list strips." };
    return NextResponse.json(body, { status: 500 });
  }
}
