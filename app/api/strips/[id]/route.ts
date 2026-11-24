import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/adapter";
import type { ApiResponse, DigitizeResult } from "@/lib/types";

// Runs the pipeline on one seeded strip by id. Takes no image and writes nothing.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const adapter = getAdapter();
  try {
    const result = adapter.getResult(id);
    if (!result) {
      const body: ApiResponse<DigitizeResult> = { ok: false, error: `No seeded strip with id "${id}".` };
      return NextResponse.json(body, { status: 404 });
    }
    const body: ApiResponse<DigitizeResult> = { ok: true, data: result, mode: adapter.mode };
    return NextResponse.json(body);
  } catch (e) {
    const body: ApiResponse<DigitizeResult> = { ok: false, error: e instanceof Error ? e.message : "The pipeline failed on this strip." };
    return NextResponse.json(body, { status: 500 });
  }
}
