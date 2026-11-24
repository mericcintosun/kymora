import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { HeldOutResults } from "@/lib/types";

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
        className="h-auto w-full"
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

/**
 * The held-out PTB-XL fold 10 table, read from the committed eval/ptbxl-results.json
 * (validated by heldOutResultsSchema on the server). Every number here was written by
 * `npm run eval -- --set ptbxl`.
 */
export function HeldOutPanel({ results }: { results: HeldOutResults }) {
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
