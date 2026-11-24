"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ResultView } from "@/components/result-view";
import { EmptyState, ErrorState, WorkspaceSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { FEATURED_STRIP_ID } from "@/lib/data";
import type { ErrorCode } from "@/lib/errors";
import type { Measurement, Raster } from "@/lib/kymora/pipeline";
import { storedLocalResultSchema } from "@/lib/schemas";

interface Stored {
  label: string;
  measurement: Measurement;
  dataUrl: string | null;
}

type State =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error"; code: ErrorCode; message: string }
  | { kind: "ready"; stored: Stored; raster?: Raster };

async function decode(dataUrl: string): Promise<Raster> {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: d.width, height: d.height, data: d.data };
}

/** Reads kymora:<id> from this tab. Never throws: a blocked storage or a bad entry becomes a coded error. */
function readStored(id: string): { kind: "missing" } | { kind: "error"; code: ErrorCode; message: string } | { kind: "ok"; stored: Stored } {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(`kymora:${id}`);
  } catch {
    return { kind: "error", code: "not_configured", message: "This browser blocked access to the tab's storage, so the result cannot be read back." };
  }
  if (!raw) return { kind: "missing" };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { kind: "error", code: "parse_failure", message: "The stored result in this tab is not valid JSON." };
  }
  const parsed = storedLocalResultSchema.safeParse(json);
  if (!parsed.success) {
    return { kind: "error", code: "invalid_input", message: "The stored result in this tab is not in the shape Kymora writes." };
  }
  return { kind: "ok", stored: parsed.data as unknown as Stored };
}

/**
 * Result page for a photo the visitor dropped. The image never left the device, so
 * the page reads it back from this tab's sessionStorage; on another device the link
 * explains that instead of pretending.
 */
export function LocalResult({ id }: { id: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  // Bumped by the retry button to run the effect again.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    const read = readStored(id);
    if (read.kind !== "ok") {
      setState(read);
      return;
    }
    const { stored } = read;
    if (!stored.dataUrl) {
      setState({ kind: "ready", stored });
      return;
    }
    decode(stored.dataUrl)
      .then((raster) => !cancelled && setState({ kind: "ready", stored, raster }))
      .catch(() => !cancelled && setState({ kind: "ready", stored }));
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  if (state.kind === "loading") {
    return <WorkspaceSkeleton label="Reading this result from your browser" />;
  }

  if (state.kind === "error") {
    return (
      <ErrorState
        title="This result could not be read"
        message={`${state.message} (${state.code}) Nothing was uploaded. Try again, or open the workspace and drop the photo once more.`}
        onRetry={() => setAttempt((n) => n + 1)}
      />
    );
  }

  if (state.kind === "missing") {
    return (
      <EmptyState
        title="This result only exists in the browser tab that made it."
        message="Kymora never uploads a photo, so a result from your own image cannot be opened on another device or after the tab is closed. Share the CSV instead, or try one of the seeded strips, which have permanent links."
        cta={
          <Button asChild>
            <Link href={`/digitize?strip=${FEATURED_STRIP_ID}`}>Open the workspace</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-3xl font-semibold">{state.stored.label}</h2>
      <ResultView label={state.stored.label} measurement={state.stored.measurement} raster={state.raster} resultPath={`/digitize/${id}`} onResultPage />
    </div>
  );
}
