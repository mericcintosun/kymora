"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toCsv, type Measurement, type Raster } from "@/lib/kymora/pipeline";
import { renderStrip, type StripParams } from "@/lib/kymora/synth";

export interface ResultReference {
  heartRateBpm: number;
  meanRrMs: number;
}

interface ResultViewProps {
  label: string;
  measurement: Measurement;
  /** Either the raster that was analysed, or the seed parameters to re-render it. */
  raster?: Raster;
  params?: StripParams;
  reference?: ResultReference;
  /** Path of this result's own page. */
  resultPath?: string;
  /** Hide the "open result page" link when we are already on it. */
  onResultPage?: boolean;
}

/** The photo with the digitized trace laid over it, the numbers, and the export controls. */
export function ResultView({ label, measurement: m, raster, params, reference, resultPath, onResultPage }: ResultViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = raster ?? (params ? renderStrip(params) : null);
    if (!img) return;
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const data = ctx.createImageData(img.width, img.height);
    data.data.set(img.data);
    ctx.putImageData(data, 0, 0);
  }, [raster, params]);

  const points = m.trace.map(([x, y]) => `${x},${y}`).join(" ");
  const stroke = Math.max(1.5, m.width / 700);

  function downloadCsv() {
    const blob = new Blob([toCsv(m, label)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kymora-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyLink() {
    if (!resultPath) return;
    try {
      await navigator.clipboard.writeText(new URL(resultPath, window.location.origin).toString());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const hrDelta = m.heartRateBpm !== null && reference ? m.heartRateBpm - reference.heartRateBpm : null;

  return (
    <div className="space-y-5">
      <figure className="relative overflow-hidden rounded-md border border-border bg-ground">
        <canvas ref={canvasRef} width={m.width} height={m.height} className="block h-auto w-full" aria-label={`Photo of ${label}`} />
        <svg viewBox={`0 0 ${m.width} ${m.height}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          <polyline
            points={points}
            fill="none"
            className={m.accepted ? "stroke-ok" : "stroke-bad"}
            strokeWidth={stroke}
            strokeDasharray={m.accepted ? undefined : `${stroke * 4} ${stroke * 3}`}
            strokeOpacity="0.85"
            strokeLinejoin="round"
          />
          {m.peaks.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={stroke * 2.6} className="fill-oxblood" fillOpacity="0.85" />
          ))}
        </svg>
        <figcaption className="flex flex-wrap items-center gap-2 border-t border-border bg-surface px-4 py-2 text-sm text-muted-foreground">
          {m.accepted ? <Badge variant="ok">Measured</Badge> : <Badge variant="bad">No reliable measurement</Badge>}
          <span>
            {m.accepted
              ? "Green line: digitized trace. Dots: detected R peaks."
              : "Dashed line: what the pipeline found, shown for inspection only."}
          </span>
        </figcaption>
      </figure>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Heart rate</CardTitle>
          </CardHeader>
          <CardContent>
            {m.heartRateBpm !== null ? (
              <p>
                <span className="font-display text-5xl font-bold">{m.heartRateBpm.toFixed(0)}</span> <span className="text-lg">bpm</span>
              </p>
            ) : (
              <p className="font-display text-2xl font-semibold">Withheld</p>
            )}
            {reference && (
              <p className="mt-2 text-sm text-muted-foreground">
                Reference {reference.heartRateBpm.toFixed(1)} bpm
                {hrDelta !== null && ` (error ${hrDelta >= 0 ? "+" : ""}${hrDelta.toFixed(1)})`}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>RR intervals</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {m.meanRrMs !== null ? (
              <>
                <p>
                  Mean <strong className="text-base">{m.meanRrMs.toFixed(0)} ms</strong>
                  {reference && <span className="text-muted-foreground"> (reference {reference.meanRrMs.toFixed(0)} ms)</span>}
                </p>
                <p className="mt-2 leading-relaxed text-muted-foreground">{m.rrMs.map((r) => r.toFixed(0)).join(", ")} ms</p>
              </>
            ) : (
              <p className="text-muted-foreground">No intervals reported for this image.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Calibration and quality</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Grid</dt>
              <dd>{m.pxPerMmX !== null ? `${m.pxPerMmX.toFixed(2)} px/mm` : "not found"}</dd>
              <dt className="text-muted-foreground">Tilt</dt>
              <dd>{m.skewDeg.toFixed(1)}°</dd>
              <dt className="text-muted-foreground">Trace continuity</dt>
              <dd>{(m.continuity * 100).toFixed(0)}%</dd>
              <dt className="text-muted-foreground">Quality</dt>
              <dd>
                {m.quality.toFixed(2)} <span className="text-muted-foreground">(gate 0.60)</span>
              </dd>
              <dt className="text-muted-foreground">Runtime</dt>
              <dd>{m.runtimeMs} ms</dd>
            </dl>
          </CardContent>
        </Card>
      </div>

      {m.reasons.length > 0 && (
        <Card className={m.accepted ? "" : "border-bad"}>
          <CardContent className="text-sm">
            <p className="font-medium">{m.accepted ? "Notes from the quality gate" : "Why Kymora withheld a number"}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              {m.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardFooter className="flex-wrap border-t-0 bg-transparent">
          <Button onClick={downloadCsv} variant="secondary" disabled={m.signal.mv.length === 0}>
            Download CSV (mV, 250 Hz)
          </Button>
          {resultPath && (
            <Button onClick={copyLink} variant="outline">
              {copied ? "Link copied" : "Copy result link"}
            </Button>
          )}
          {resultPath && !onResultPage && (
            <Button asChild variant="link">
              <Link href={resultPath}>Open this result as its own page</Link>
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
