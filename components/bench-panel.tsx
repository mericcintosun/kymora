"use client";

import { useRef, useState } from "react";
import { FigureTween } from "@/components/held-out-panel";
import { EmptyState, ErrorState, Skeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BENCH_DEFAULTS, HIST_EDGES, runBench, type BenchSummary } from "@/lib/kymora/bench";

type State = { kind: "idle" } | { kind: "running"; done: number; total: number } | { kind: "done"; summary: BenchSummary } | { kind: "error"; message: string };

const fmt = (v: number | null, d: number) => (v === null ? "n/a" : v.toFixed(d));

function binLabel(i: number): string {
  if (i === 0) return `< ${HIST_EDGES[0]}`;
  if (i === HIST_EDGES.length) return `≥ ${HIST_EDGES[HIST_EDGES.length - 1]}`;
  return `${HIST_EDGES[i - 1]} to ${HIST_EDGES[i]}`;
}

/** One small-multiple histogram of signed HR error. Bars carry a native tooltip with the exact count. */
function ErrorHistogram({ title, bins, barClass }: { title: string; bins: number[]; barClass: string }) {
  const max = Math.max(1, ...bins);
  const W = 420;
  const H = 150;
  const bw = W / bins.length;
  return (
    <figure>
      <figcaption className="mb-2 text-sm font-medium">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H + 28}`} className="h-auto w-full max-w-full" role="img" aria-label={`${title}: ${bins.map((b, i) => `${binLabel(i)} bpm: ${b}`).join(", ")}`}>
        <line x1="0" x2={W} y1={H} y2={H} className="stroke-line" strokeWidth="1" />
        {bins.map((b, i) => {
          const h = (b / max) * (H - 12);
          return (
            <g key={i}>
              <rect x={i * bw + 1} y={H - h} width={bw - 2} height={h} rx="3" className={barClass}>
                <title>{`${binLabel(i)} bpm: ${b} strip${b === 1 ? "" : "s"}`}</title>
              </rect>
              <rect x={i * bw} y="0" width={bw} height={H} fill="transparent">
                <title>{`${binLabel(i)} bpm: ${b} strip${b === 1 ? "" : "s"}`}</title>
              </rect>
            </g>
          );
        })}
        <text x={bw / 2} y={H + 18} textAnchor="middle" className="fill-muted-foreground text-[11px]">
          &lt; -12
        </text>
        <text x={7 * bw} y={H + 18} textAnchor="middle" className="fill-muted-foreground text-[11px]">
          0
        </text>
        <text x={W} y={H + 18} textAnchor="end" className="fill-muted-foreground text-[11px]">
          ≥ 12 bpm
        </text>
      </svg>
    </figure>
  );
}

/**
 * Runs the synthetic bench in the visitor's browser with the same code and seed as
 * `npm run eval`, so the numbers on this page are produced, not pasted.
 */
export function BenchPanel({ seed = BENCH_DEFAULTS.seed, n = BENCH_DEFAULTS.n }: { seed?: number; n?: number } = {}) {
  const [state, setState] = useState<State>({ kind: "idle" });
  // One bench at a time, even if a second click lands before the button re-renders disabled.
  const busyRef = useRef(false);
  const running = state.kind === "running";

  async function run() {
    if (busyRef.current) return;
    busyRef.current = true;
    setState({ kind: "running", done: 0, total: n });
    try {
      const summary = await runBench({ seed, n, onProgress: (done, total) => setState({ kind: "running", done, total }) });
      setState({ kind: "done", summary });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "The bench failed." });
    } finally {
      busyRef.current = false;
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Synthetic bench, run it here</CardTitle>
        <p className="max-w-[68ch] text-sm text-muted-foreground">
          Seed {seed}, {n} strips with tilt, blur, shadow, noise and scale drawn from the seed.
          About 25% are degraded on purpose. Takes roughly 10 seconds.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {state.kind === "idle" && (
          <EmptyState
            title="No bench results yet"
            message={`Nothing is precomputed here. Press Run the bench: after the ${n} strips run in this tab, the Kymora against baseline figures, the table and the two error histograms appear.`}
            cta={<Button onClick={run}>Run the bench</Button>}
          />
        )}

        {(state.kind === "running" || state.kind === "done") && (
          <Button
            onClick={run}
            disabled={running}
            aria-disabled={running}
            variant={state.kind === "done" ? "outline" : "default"}
            className="whitespace-normal text-left"
          >
            {state.kind === "done" ? "Run again (same seed, same numbers)" : "Running the bench"}
          </Button>
        )}

        {state.kind === "running" && (
          <div role="status" aria-live="polite" aria-busy="true" className="space-y-2">
            <p className="text-sm">
              Strip {state.done} of {state.total}
            </p>
            <div className="h-3 overflow-hidden rounded-md bg-deep">
              <div className="h-full bg-primary transition-[width]" style={{ width: `${(state.done / state.total) * 100}%` }} />
            </div>
            <Skeleton className="h-32" />
          </div>
        )}

        {state.kind === "error" && (
          <ErrorState title="The bench stopped" message={state.message} onRetry={run} retryLabel="Run the bench again" />
        )}

        {state.kind === "done" && (
          <>
            {/* Fallback home of signature 3 when the held-out file is absent: the same tween, fed by the bench that just ran. */}
            <FigureTween
              kymora={{
                name: "Kymora",
                hrMae: state.summary.rows[0].hrMae,
                rrMae: state.summary.rows[0].rrMae,
                rejectionRate: state.summary.rows[0].rejectionRate,
                bins: state.summary.histogram.kymora,
              }}
              baseline={{
                name: "baseline",
                hrMae: state.summary.rows[1].hrMae,
                rrMae: state.summary.rows[1].rrMae,
                rejectionRate: state.summary.rows[1].rejectionRate,
                bins: state.summary.histogram.baseline,
              }}
              edges={state.summary.histogram.edges}
              unitNoun="strip"
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <caption className="sr-only">Bench results by method</caption>
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Method</th>
                    <th className="py-2 pr-4 font-medium">Strips reported</th>
                    <th className="py-2 pr-4 font-medium">HR MAE (bpm)</th>
                    <th className="py-2 pr-4 font-medium">RR MAE (ms)</th>
                    <th className="py-2 pr-4 font-medium">SNR (dB)</th>
                    <th className="py-2 font-medium">Rejected</th>
                  </tr>
                </thead>
                <tbody>
                  {state.summary.rows.map((r, i) => (
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
              <ErrorHistogram title="Kymora: signed HR error, reported strips" bins={state.summary.histogram.kymora} barClass="fill-oxblood" />
              <ErrorHistogram title="Baseline: signed HR error, all strips" bins={state.summary.histogram.baseline} barClass="fill-ink" />
            </div>
            <p className="max-w-[68ch] text-sm text-muted-foreground">
              Read the first two rows together: Kymora&apos;s error is measured only on strips it agreed to report, so its
              rejection rate is part of the result. The third row scores the baseline on that same subset for a fair
              comparison.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
