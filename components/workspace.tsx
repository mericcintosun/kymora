"use client";

import { useCallback, useEffect, useState } from "react";
import { ResultView, type ResultReference } from "@/components/result-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { StripSeed } from "@/lib/data";
import { digitize, type Measurement, type Raster } from "@/lib/kymora/pipeline";
import { referenceFor, renderStrip } from "@/lib/kymora/synth";

const MAX_SIDE = 2400;

type State =
  | { kind: "empty" }
  | { kind: "working"; label: string }
  | { kind: "done"; label: string; measurement: Measurement; raster: Raster; reference?: ResultReference; resultPath: string }
  | { kind: "error"; message: string };

const nextFrame = () => new Promise<void>((r) => setTimeout(r, 30));

/** Decode a dropped photo on the device and downscale it so the longest side is at most 2400 px. */
async function rasterFromFile(file: File): Promise<{ raster: Raster; dataUrl: string }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot read images into a canvas.");
  ctx.drawImage(bmp, 0, 0, w, h);
  const id = ctx.getImageData(0, 0, w, h);
  return { raster: { width: w, height: h, data: id.data }, dataUrl: canvas.toDataURL("image/jpeg", 0.82) };
}

export function Workspace({ strips, initialId }: { strips: StripSeed[]; initialId: string }) {
  const [activeId, setActiveId] = useState(initialId);
  const [state, setState] = useState<State>(
    strips.some((s) => s.id === initialId) ? { kind: "working", label: "Loading example" } : { kind: "empty" }
  );
  const [dragging, setDragging] = useState(false);

  const runSeed = useCallback(
    async (id: string) => {
      const strip = strips.find((s) => s.id === id);
      if (!strip) {
        setState({ kind: "empty" });
        return;
      }
      setActiveId(id);
      setState({ kind: "working", label: strip.title });
      await nextFrame();
      try {
        const raster = renderStrip(strip.params);
        const measurement = digitize(raster);
        const ref = referenceFor(strip.params);
        setState({
          kind: "done",
          label: strip.title,
          measurement,
          raster,
          reference: { heartRateBpm: ref.heartRateBpm, meanRrMs: ref.meanRrMs },
          resultPath: `/digitize/${strip.id}`,
        });
        window.history.replaceState(null, "", `/digitize?strip=${strip.id}`);
      } catch (e) {
        setState({ kind: "error", message: e instanceof Error ? e.message : "The pipeline failed on this strip." });
      }
    },
    [strips]
  );

  const runFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setState({ kind: "error", message: `${file.name} is not an image. Drop a JPEG or PNG photo of the strip.` });
      return;
    }
    setActiveId("upload");
    setState({ kind: "working", label: file.name });
    await nextFrame();
    let decoded: { raster: Raster; dataUrl: string };
    try {
      decoded = await rasterFromFile(file);
    } catch {
      setState({
        kind: "error",
        message: `${file.name} could not be decoded as an image. Try a JPEG or PNG photo of one lead II strip. Nothing was uploaded.`,
      });
      return;
    }
    try {
      const { raster, dataUrl } = decoded;
      const measurement = digitize(raster);
      const id = `local-${Date.now().toString(36)}`;
      try {
        sessionStorage.setItem(`kymora:${id}`, JSON.stringify({ label: file.name, measurement, dataUrl }));
      } catch {
        sessionStorage.setItem(`kymora:${id}`, JSON.stringify({ label: file.name, measurement, dataUrl: null }));
      }
      setState({ kind: "done", label: file.name, measurement, raster, resultPath: `/digitize/${id}` });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Could not read that image." });
    }
  }, []);

  useEffect(() => {
    void runSeed(initialId);
  }, [initialId, runSeed]);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div>
          <p className="mb-3 text-sm font-medium">Seeded strips</p>
          <div className="flex flex-wrap gap-2">
            {strips.map((s) => (
              <Button
                key={s.id}
                variant={s.id === activeId ? "default" : "outline"}
                size="sm"
                onClick={() => void runSeed(s.id)}
                aria-pressed={s.id === activeId}
                title={s.capture}
              >
                {s.title}
              </Button>
            ))}
          </div>
        </div>
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) void runFile(f);
          }}
          className={cn(
            "flex cursor-pointer flex-col justify-center gap-1 rounded-md border-2 border-dashed border-line bg-surface p-5 text-sm transition-colors hover:border-primary focus-within:border-primary focus-within:ring-2 focus-within:ring-ring",
            dragging && "border-primary bg-deep",
            activeId === "upload" && "border-primary"
          )}
        >
          <span className="font-display text-lg font-semibold">Drop your own strip photo</span>
          <span className="text-muted-foreground">One lead II rhythm strip on red or pink grid paper. Crop out the 12-lead block first. Stays on this device.</span>
          <Input
            type="file"
            accept="image/*"
            aria-label="Choose a photo of an ECG rhythm strip"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void runFile(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {state.kind === "empty" && (
        <Card aria-live="polite">
          <CardContent className="space-y-2">
            <p className="font-medium">No strip selected yet</p>
            <p className="text-sm text-muted-foreground">
              Pick one of the seeded strips above, or drop a photo of your own strip on the sand panel. The trace, heart
              rate and RR intervals will appear here.
            </p>
          </CardContent>
        </Card>
      )}

      {state.kind === "working" && (
        <Card aria-live="polite" className="kymora-enter">
          <CardContent className="space-y-3">
            <p className="font-medium">Reading {state.label}</p>
            <p className="text-sm text-muted-foreground">Finding the grid, deskewing, tracing the ink, detecting beats. This runs on your device.</p>
            <div className="h-40 rounded-md bg-deep/60" />
          </CardContent>
        </Card>
      )}

      {state.kind === "error" && (
        <Card className="border-bad" role="alert">
          <CardContent>
            <p className="font-medium">That did not work</p>
            <p className="mt-1 text-sm text-muted-foreground">{state.message}</p>
          </CardContent>
        </Card>
      )}

      {state.kind === "done" && (
        <div className="kymora-enter" key={state.resultPath}>
          <h2 className="mb-4 text-3xl font-semibold">{state.label}</h2>
          <ResultView
            label={state.label}
            measurement={state.measurement}
            raster={state.raster}
            reference={state.reference}
            resultPath={state.resultPath}
          />
        </div>
      )}
    </div>
  );
}
