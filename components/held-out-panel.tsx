"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { HeldOutResults } from "@/lib/types";

if (typeof window !== "undefined") gsap.registerPlugin(useGSAP);

const fmt = (v: number | null, d: number) => (v === null ? "n/a" : v.toFixed(d));

const RENDERER_NAME: Record<HeldOutResults["renderer"], string> = {
  "ecg-image-kit": "ECG-Image-Kit",
  matplotlib: "a seeded matplotlib renderer",
};

function binLabel(edges: number[], i: number): string {
  if (i === 0) return `< ${edges[0]}`;
  if (i === edges.length) return `≥ ${edges[edges.length - 1]}`;
  return `${edges[i - 1]} to ${edges[i]}`;
}

/** Signed HR error histogram, drawn the same way as the live bench panel. */
function ErrorHistogram({ title, edges, bins, barClass }: { title: string; edges: number[]; bins: number[]; barClass: string }) {
  const max = Math.max(1, ...bins);
  const W = 420;
  const H = 120;
  const bw = W / Math.max(1, bins.length);
  const zero = edges.indexOf(0);
  return (
    <figure>
      <figcaption className="mb-2 text-sm font-medium">{title}</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H + 28}`}
        className="h-auto w-full max-w-full"
        role="img"
        aria-label={`${title}: ${bins.map((b, i) => `${binLabel(edges, i)} bpm: ${b}`).join(", ")}`}
      >
        <line x1="0" x2={W} y1={H} y2={H} className="stroke-line" strokeWidth="1" />
        {bins.map((b, i) => {
          const h = (b / max) * (H - 12);
          return (
            <rect key={i} x={i * bw + 1} y={H - h} width={bw - 2} height={h} rx="3" className={barClass}>
              <title>{`${binLabel(edges, i)} bpm: ${b} image${b === 1 ? "" : "s"}`}</title>
            </rect>
          );
        })}
        <text x={bw / 2} y={H + 18} textAnchor="middle" className="fill-muted-foreground text-[11px]">
          &lt; {edges[0]}
        </text>
        {zero >= 0 && (
          <text x={(zero + 1) * bw} y={H + 18} textAnchor="middle" className="fill-muted-foreground text-[11px]">
            0
          </text>
        )}
        <text x={W} y={H + 18} textAnchor="end" className="fill-muted-foreground text-[11px]">
          ≥ {edges[edges.length - 1]} bpm
        </text>
      </svg>
    </figure>
  );
}

/* ------------------------------------------------------------------------------------
 * Signature 3 (K2): a figure tween bound to a control.
 *
 * The toggle switches the readout between Kymora and the baseline. GSAP tweens one plain
 * proxy object (HR MAE, RR MAE, rejection rate and one height per histogram bar) and
 * paints the figures and the bars from it on every frame, so numbers and bars move
 * together. Every value comes from a result object the caller already computed: the
 * zod-checked held-out file, or the bench summary that just ran in this tab.
 *
 * The server HTML shows the Kymora values and bars, final and readable. Under
 * prefers-reduced-motion the matchMedia "reduce" branch paints the target at once.
 * ---------------------------------------------------------------------------------- */

export interface TweenSide {
  /** Short name shown on the toggle and in the caption. */
  name: string;
  hrMae: number | null;
  rrMae: number | null;
  /** 0 to 1. */
  rejectionRate: number;
  /** Signed HR error histogram counts. */
  bins: number[];
}

type Shown = "kymora" | "baseline";
type Proxy = Record<string, number>;

const TW = 420;
const TH = 140;

function toProxy(s: TweenSide, len: number, max: number): Proxy {
  const p: Proxy = { hr: s.hrMae ?? 0, rr: s.rrMae ?? 0, rej: s.rejectionRate * 100 };
  for (let i = 0; i < len; i++) p[`b${i}`] = ((s.bins[i] ?? 0) / max) * (TH - 12);
  return p;
}

/** Writes the proxy onto the figures and bars. A null target figure reads "n/a", never an invented number. */
function paint(root: HTMLElement, p: Proxy, target: TweenSide) {
  const put = (key: string, text: string) => {
    const el = root.querySelector<HTMLElement>(`[data-fig='${key}']`);
    if (el) el.textContent = text;
  };
  put("hr", target.hrMae === null ? "n/a" : p.hr.toFixed(2));
  put("rr", target.rrMae === null ? "n/a" : p.rr.toFixed(1));
  put("rej", `${p.rej.toFixed(1)}%`);
  root.querySelectorAll<SVGRectElement>("[data-bar]").forEach((el, i) => {
    const h = Math.max(0, p[`b${i}`] ?? 0);
    el.setAttribute("y", (TH - h).toFixed(2));
    el.setAttribute("height", h.toFixed(2));
  });
}

export function FigureTween({
  kymora,
  baseline,
  edges,
  unitNoun,
}: {
  kymora: TweenSide;
  baseline: TweenSide;
  edges: number[];
  /** "image" for the held-out set, "strip" for the bench. */
  unitNoun: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState<Shown>("kymora");
  const len = Math.max(kymora.bins.length, baseline.bins.length);
  const max = Math.max(1, ...kymora.bins, ...baseline.bins);
  // What the DOM currently shows. Starts equal to the server HTML (Kymora).
  const proxy = useRef<Proxy>(toProxy(kymora, len, max));
  const painted = useRef<Shown>("kymora");
  const mmRef = useRef<ReturnType<typeof gsap.matchMedia> | null>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root || painted.current === shown) return;
      painted.current = shown;
      const target = shown === "kymora" ? kymora : baseline;
      const to = toProxy(target, len, max);
      const p = proxy.current;
      // Stop a tween still in flight, keeping the values it reached as the new start.
      const reached = { ...p };
      mmRef.current?.revert();
      Object.assign(p, reached);

      const mm = gsap.matchMedia();
      mmRef.current = mm;
      mm.add({ motion: "(prefers-reduced-motion: no-preference)", reduce: "(prefers-reduced-motion: reduce)" }, (ctx) => {
        if (ctx.conditions?.reduce) {
          Object.assign(p, to);
          paint(root, p, target);
          return;
        }
        gsap.to(p, { ...to, duration: 0.7, ease: "power2.out", onUpdate: () => paint(root, p, target) });
      });
    },
    { scope: rootRef, dependencies: [shown] }
  );

  const current = shown === "kymora" ? kymora : baseline;
  const bw = TW / Math.max(1, len);
  const zero = edges.indexOf(0);

  return (
    <div ref={rootRef} className="rounded-md border border-border bg-ground p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-lg font-semibold">Kymora against the baseline</p>
        <div role="group" aria-label="Method shown in the figures" className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={shown === "baseline" ? "default" : "outline"}
            aria-pressed={shown === "baseline"}
            onClick={() => setShown("baseline")}
          >
            Show baseline
          </Button>
          <Button
            type="button"
            variant={shown === "kymora" ? "default" : "outline"}
            aria-pressed={shown === "kymora"}
            onClick={() => setShown("kymora")}
          >
            Show Kymora
          </Button>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        Showing {current.name}
      </p>

      <div className="mt-5 grid gap-6 md:grid-cols-[14rem_1fr] md:items-end">
        {/* The figures are written by GSAP after the first paint; React renders the Kymora values once. */}
        <dl className="grid grid-cols-3 gap-3 md:grid-cols-1 md:gap-4">
          <div>
            <dt className="text-xs text-muted-foreground">HR MAE (bpm)</dt>
            <dd className="font-display text-2xl font-semibold sm:text-3xl" data-fig="hr">
              {fmt(kymora.hrMae, 2)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">RR MAE (ms)</dt>
            <dd className="font-display text-2xl font-semibold sm:text-3xl" data-fig="rr">
              {fmt(kymora.rrMae, 1)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Rejected</dt>
            <dd className="font-display text-2xl font-semibold sm:text-3xl" data-fig="rej">
              {(kymora.rejectionRate * 100).toFixed(1)}%
            </dd>
          </div>
        </dl>

        <figure>
          <figcaption className="mb-2 text-sm text-muted-foreground">
            Signed HR error, {current.name}, {unitNoun}s with a reported rate
          </figcaption>
          <svg viewBox={`0 0 ${TW} ${TH + 28}`} className="h-auto w-full max-w-full" role="img" aria-label={`Signed heart rate error histogram for ${current.name}`}>
            <line x1="0" x2={TW} y1={TH} y2={TH} className="stroke-line" strokeWidth="1" />
            {Array.from({ length: len }, (_, i) => {
              const h = ((kymora.bins[i] ?? 0) / max) * (TH - 12);
              const count = current.bins[i] ?? 0;
              return (
                <rect
                  key={i}
                  data-bar
                  x={i * bw + 1}
                  y={TH - h}
                  width={Math.max(0, bw - 2)}
                  height={h}
                  rx="3"
                  className={shown === "kymora" ? "fill-oxblood" : "fill-ink"}
                >
                  <title>{`${binLabel(edges, i)} bpm: ${count} ${unitNoun}${count === 1 ? "" : "s"}`}</title>
                </rect>
              );
            })}
            <text x={bw / 2} y={TH + 18} textAnchor="middle" className="fill-muted-foreground text-[11px]">
              &lt; {edges[0]}
            </text>
            {zero >= 0 && (
              <text x={(zero + 1) * bw} y={TH + 18} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                0
              </text>
            )}
            <text x={TW} y={TH + 18} textAnchor="end" className="fill-muted-foreground text-[11px]">
              ≥ {edges[edges.length - 1]} bpm
            </text>
          </svg>
        </figure>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Bars share one scale across both methods. The baseline is scored on all {unitNoun}s; the table below also scores it on
        the {unitNoun}s Kymora accepted.
      </p>
    </div>
  );
}

/**
 * The held-out PTB-XL fold 10 table, read from the committed eval/ptbxl-results.json
 * (validated by heldOutResultsSchema on the server). Every number here was written by
 * `npm run eval -- --set ptbxl`.
 */
export function HeldOutPanel({ results }: { results: HeldOutResults }) {
  const [k, b] = results.rows;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Held-out set: PTB-XL fold 10</CardTitle>
        <p className="max-w-[68ch] text-sm text-muted-foreground">
          {results.n} lead II strips rendered as paper images by {RENDERER_NAME[results.renderer]}, seed {results.seed}.
          Generated {results.generatedAt.slice(0, 10)} by <code>npm run eval -- --set ptbxl</code> and read from{" "}
          <code>eval/ptbxl-results.json</code>. Never used for tuning.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <FigureTween
          kymora={{ name: "Kymora", hrMae: k.hrMae, rrMae: k.rrMae, rejectionRate: k.rejectionRate, bins: results.histogram.kymora }}
          baseline={{ name: "baseline", hrMae: b.hrMae, rrMae: b.rrMae, rejectionRate: b.rejectionRate, bins: results.histogram.baseline }}
          edges={results.histogram.edges}
          unitNoun="image"
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <caption className="sr-only">Held-out PTB-XL fold 10 results by method</caption>
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Method</th>
                <th className="py-2 pr-4 font-medium">Images reported</th>
                <th className="py-2 pr-4 font-medium">HR MAE (bpm)</th>
                <th className="py-2 pr-4 font-medium">RR MAE (ms)</th>
                <th className="py-2 pr-4 font-medium">SNR (dB)</th>
                <th className="py-2 font-medium">Rejected</th>
              </tr>
            </thead>
            <tbody>
              {results.rows.map((r, i) => (
                <tr key={r.method} className={i === 0 ? "border-b border-border font-medium" : "border-b border-border/60"}>
                  <td className="py-2 pr-4">{r.method}</td>
                  <td className="py-2 pr-4">{r.n}</td>
                  <td className="py-2 pr-4">{fmt(r.hrMae, 2)}</td>
                  <td className="py-2 pr-4">{fmt(r.rrMae, 1)}</td>
                  <td className="py-2 pr-4">{fmt(r.snrDb, 2)}</td>
                  <td className="py-2">{(r.rejectionRate * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <ErrorHistogram
            title="Kymora: signed HR error, reported images"
            edges={results.histogram.edges}
            bins={results.histogram.kymora}
            barClass="fill-oxblood"
          />
          <ErrorHistogram
            title="Baseline: signed HR error, all images"
            edges={results.histogram.edges}
            bins={results.histogram.baseline}
            barClass="fill-ink"
          />
        </div>
      </CardContent>
    </Card>
  );
}
