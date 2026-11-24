import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/adapter";
import type { ApiResponse, BenchSummary } from "@/lib/types";

// Same seed and strips as the /how panel and `npm run eval -- --n 40`, computed once at build time.
export const dynamic = "force-static";

export function GET() {
  const adapter = getAdapter();
  try {
    const body: ApiResponse<BenchSummary> = { ok: true, data: adapter.getBench(), mode: adapter.mode };
    return NextResponse.json(body);
  } catch (e) {
    const body: ApiResponse<BenchSummary> = { ok: false, error: e instanceof Error ? e.message : "The bench failed." };
    return NextResponse.json(body, { status: 500 });
  }
}
