"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ResultView } from "@/components/result-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Measurement, Raster } from "@/lib/kymora/pipeline";

interface Stored {
  label: string;
  measurement: Measurement;
  dataUrl: string | null;
}

type State = { kind: "loading" } | { kind: "missing" } | { kind: "ready"; stored: Stored; raster?: Raster };

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

/**
 * Result page for a photo the visitor dropped. The image never left the device, so
 * the page reads it back from this tab's sessionStorage; on another device the link
 * explains that instead of pretending.
 */
export function LocalResult({ id }: { id: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const raw = sessionStorage.getItem(`kymora:${id}`);
    if (!raw) {
      setState({ kind: "missing" });
      return;
    }
    const stored = JSON.parse(raw) as Stored;
    if (!stored.dataUrl) {
      setState({ kind: "ready", stored });
      return;
    }
    decode(stored.dataUrl)
      .then((raster) => setState({ kind: "ready", stored, raster }))
      .catch(() => setState({ kind: "ready", stored }));
  }, [id]);

  if (state.kind === "loading") {
    return (
      <Card>
        <CardContent className="text-muted-foreground">Reading this result from your browser…</CardContent>
      </Card>
    );
  }

  if (state.kind === "missing") {
    return (
      <Card>
        <CardContent className="space-y-3">
          <p className="font-medium">This result only exists in the browser tab that made it.</p>
          <p className="max-w-[65ch] text-sm text-muted-foreground">
            Kymora never uploads a photo, so a result from your own image cannot be opened on another device or after the
            tab is closed. Share the CSV instead, or try one of the seeded strips, which have permanent links.
          </p>
          <Button asChild>
            <Link href="/digitize">Open the workspace</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-3xl font-semibold">{state.stored.label}</h2>
      <ResultView label={state.stored.label} measurement={state.stored.measurement} raster={state.raster} resultPath={`/digitize/${id}`} onResultPage />
    </div>
  );
}
