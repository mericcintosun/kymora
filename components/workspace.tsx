"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ResultView, type ResultReference } from "@/components/result-view";
import { EmptyState, ErrorState, WorkspaceSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { StripSeed } from "@/lib/data";
import { ecgIdFromFilename } from "@/lib/ecg-id";
import { fileKey } from "@/lib/file-key";
import { digitize, type Measurement, type Raster } from "@/lib/kymora/pipeline";
import { referenceFor, renderStrip } from "@/lib/kymora/synth";
import type { PtbxlLookup } from "@/lib/schemas";

export { fileKey };

/** Caps the decoded photo so the in-browser pipeline stays inside the 5 s demo budget. */
const MAX_SIDE = 2400;

type State =
  | { kind: "empty" }
  | { kind: "working"; label: string }
  | {
      kind: "done";
      runId: number;
      label: string;
      measurement: Measurement;
      raster: Raster;
      reference?: ResultReference;
      referenceLabel?: string;
      /** Undefined when the result could not be stored in this tab, so there is no link to share. */
      resultPath?: string;
    }
  | { kind: "error"; title: string; message: string };

/** What the retry button re-runs: a seeded strip id or the dropped file itself. */
type Source = { kind: "seed"; id: string } | { kind: "file"; file: File };

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

/**
 * Stores a local result in this tab. Tries with the photo first, then without it. Returns
 * false when even the small entry does not fit (storage full or blocked), so the caller
 * can finish the result without a link instead of failing.
 */
function storeLocal(id: string, label: string, measurement: Measurement, dataUrl: string): boolean {
  try {
    sessionStorage.setItem(`kymora:${id}`, JSON.stringify({ label, measurement, dataUrl }));
    return true;
  } catch {
    try {
      sessionStorage.setItem(`kymora:${id}`, JSON.stringify({ label, measurement, dataUrl: null }));
      return true;
    } catch {
      return false;
    }
  }
}

export function Workspace({
  strips,
  initialId,
  featuredId,
  lookup,
}: {
  strips: StripSeed[];
  initialId: string;
  featuredId: string;
  /** PTB-XL ecg_id to reference lookup from the server, or null when this build has none. */
  lookup: PtbxlLookup | null;
}) {
  const [activeId, setActiveId] = useState(initialId);
  const [state, setState] = useState<State>(
    strips.some((s) => s.id === initialId) ? { kind: "working", label: "Loading example" } : { kind: "empty" }
  );
  const [dragging, setDragging] = useState(false);
  // Write-path guards: one run at a time, and the last source for a real retry.
  const busyRef = useRef(false);
  const runCounter = useRef(0);
  const lastSource = useRef<Source | null>(null);
  // Idempotency guard: fileKey -> the local- id already created for that file in this tab.
  // Dropping the same photo again reuses the id and never writes a second sessionStorage entry.
  const localIds = useRef(new Map<string, string>());

  const working = state.kind === "working";

  const runSeed = useCallback(
    async (id: string) => {
      if (busyRef.current) return;
      const strip = strips.find((s) => s.id === id);
      if (!strip) {
        setState({ kind: "empty" });
        return;
      }
      busyRef.current = true;
      lastSource.current = { kind: "seed", id };
      try {
        setActiveId(id);
        setState({ kind: "working", label: strip.title });
        await nextFrame();
        const raster = renderStrip(strip.params);
        const measurement = digitize(raster);
        const ref = referenceFor(strip.params);
        setState({
          kind: "done",
          runId: ++runCounter.current,
          label: strip.title,
          measurement,
          raster,
          reference: { heartRateBpm: ref.heartRateBpm, meanRrMs: ref.meanRrMs },
          resultPath: `/digitize/${strip.id}`,
        });
        window.history.replaceState(null, "", `/digitize?strip=${strip.id}`);
      } catch (e) {
        setState({
          kind: "error",
          title: "That did not work",
          message: e instanceof Error ? e.message : "The pipeline failed on this strip.",
        });
      } finally {
        busyRef.current = false;
      }
    },
    [strips]
  );

  const runFile = useCallback(
    async (file: File) => {
      if (busyRef.current) return;
      lastSource.current = { kind: "file", file };
      if (!file.type.startsWith("image/")) {
        setState({
          kind: "error",
          title: "That file is not a photo",
          message: `${file.name} is not an image. Drop a JPEG or PNG photo of the strip. Nothing was uploaded.`,
        });
        return;
      }
      busyRef.current = true;
      try {
        setActiveId("upload");
        setState({ kind: "working", label: file.name });
        await nextFrame();
        let decoded: { raster: Raster; dataUrl: string };
        try {
          decoded = await rasterFromFile(file);
        } catch {
          setState({
            kind: "error",
            title: "That photo could not be read",
            message: `${file.name} could not be decoded as an image. Try a JPEG or PNG photo of one lead II strip. Nothing was uploaded.`,
          });
          return;
        }
        const { raster, dataUrl } = decoded;
        const measurement = digitize(raster);

        // PTB-XL reference only when the filename names an ecg_id that is in the committed lookup.
        const ecgId = ecgIdFromFilename(file.name);
        const hit = ecgId !== null && lookup ? lookup.records[String(ecgId)] : undefined;
        const reference = hit ? { heartRateBpm: hit.heartRateBpm, meanRrMs: hit.meanRrMs } : undefined;
        const referenceLabel = hit ? `PTB-XL fold 10 reference, ecg_id ${ecgId}` : undefined;

        const key = fileKey(file);
        let id = localIds.current.get(key);
        if (!id) {
          const fresh = `local-${Date.now().toString(36)}`;
          if (storeLocal(fresh, file.name, measurement, dataUrl)) {
            localIds.current.set(key, fresh);
            id = fresh;
          }
        }
        setState({
          kind: "done",
          runId: ++runCounter.current,
          label: file.name,
          measurement,
          raster,
          reference,
          referenceLabel,
          resultPath: id ? `/digitize/${id}` : undefined,
        });
      } catch (e) {
        setState({
          kind: "error",
          title: "That did not work",
          message: e instanceof Error ? e.message : "Could not read that image. Nothing was uploaded.",
        });
      } finally {
        busyRef.current = false;
      }
    },
    [lookup]
  );

  const retry = useCallback(() => {
    const src = lastSource.current;
    if (!src) return void runSeed(featuredId);
    if (src.kind === "seed") void runSeed(src.id);
    else void runFile(src.file);
  }, [featuredId, runFile, runSeed]);

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
                disabled={working}
                aria-disabled={working}
                aria-pressed={s.id === activeId}
                title={s.capture}
              >
                {s.title}
              </Button>
            ))}
          </div>
        </div>
        {/* The drag handlers sit on this wrapper so a drop during a run is still caught (and ignored) instead of opening the file in the tab. */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!working) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (working) return;
            const f = e.dataTransfer.files[0];
            if (f) void runFile(f);
          }}
        >
          <label
            aria-disabled={working}
            className={cn(
              "flex h-full cursor-pointer flex-col justify-center gap-1 rounded-md border-2 border-dashed border-line bg-surface p-5 text-sm transition-colors hover:border-primary focus-within:border-primary focus-within:ring-2 focus-within:ring-ring",
              dragging && "border-primary bg-deep",
              activeId === "upload" && "border-primary",
              working && "pointer-events-none opacity-60"
            )}
          >
            <span className="font-display text-lg font-semibold">Drop your own strip photo</span>
            <span className="text-muted-foreground">
              One lead II rhythm strip on red or pink grid paper. Crop out the 12-lead block first. Stays on this device.
              {lookup && " A PTB-XL fold 10 photo named after its ecg_id (for example 00009.png) shows its reference."}
            </span>
            <Input
              type="file"
              accept="image/*"
              aria-label="Choose a photo of an ECG rhythm strip"
              className="sr-only"
              disabled={working}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void runFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </div>

      {state.kind === "empty" && (
        <EmptyState
          title="No strip selected yet"
          message="Pick one of the seeded strips above, or drop a photo of your own strip on the sand panel. The trace, heart rate and RR intervals will appear here."
          cta={<Button onClick={() => void runSeed(featuredId)}>Run the example strip</Button>}
        />
      )}

      {state.kind === "working" && (
        <WorkspaceSkeleton
          label={`Reading ${state.label}`}
          detail="Finding the grid, deskewing, tracing the ink, detecting beats. This runs on your device."
        />
      )}

      {state.kind === "error" && <ErrorState title={state.title} message={state.message} onRetry={retry} />}

      {state.kind === "done" && (
        <div className="kymora-enter" key={state.runId}>
          <h2 className="mb-4 text-3xl font-semibold">{state.label}</h2>
          {!state.resultPath && (
            <p className="mb-4 text-sm text-muted-foreground">
              Result link unavailable: this tab&apos;s storage is full or blocked, so this result has no page of its own. The
              CSV download still works.
            </p>
          )}
          <ResultView
            label={state.label}
            measurement={state.measurement}
            raster={state.raster}
            reference={state.reference}
            referenceLabel={state.referenceLabel}
            resultPath={state.resultPath}
          />
        </div>
      )}
    </div>
  );
}
