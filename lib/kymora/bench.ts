/**
 * Evaluation bench shared by the /how page (in the browser) and `npm run eval`
 * (in Node). Same strips, same seed, same code path, so the two print the same table.
 *
 * Metrics, all in clinical units:
 *   HR MAE (bpm)      |reported heart rate - reference heart rate|
 *   RR MAE (ms)       each detected RR interval vs the reference interval that starts
 *                     at the true R peak nearest to the detected one (within 150 ms)
 *   SNR (dB)          10 log10(sum ref^2 / sum (ref - est)^2), mean removed, best lag
 *                     within +/- 60 ms (the PhysioNet Challenge 2024 digitization metric)
 *   Rejection rate    share of strips where the quality gate withheld a result
 */
import { baselineDigitize, digitize, type BaselineMeasurement, type Measurement, type Raster, type Signal } from "./pipeline";
import { mulberry32, referenceFor, renderStrip, type Reference, type StripParams } from "./synth";

export const BENCH_DEFAULTS = { seed: 42, n: 40 } as const;

/** Deterministic bench strips. Roughly a quarter are degraded hard enough to be rejected. */
export function benchStrips(seed: number, n: number): StripParams[] {
  const rng = mulberry32(seed);
  const between = (a: number, b: number) => a + (b - a) * rng();
  const out: StripParams[] = [];
  for (let i = 0; i < n; i++) {
    const irregular = rng() < 0.15;
    const hard = rng() < 0.25;
    out.push({
      seed: seed * 1000 + i,
      heartRateBpm: Math.round(between(40, 150)),
      rrJitterMs: irregular ? Math.round(between(120, 200)) : Math.round(between(5, 60)),
      pxPerMm: Math.round(between(4.5, 9) * 100) / 100,
      skewDeg: Math.round(between(-5, 5) * 10) / 10,
      blurPx: hard ? Math.round(between(2, 4) * 10) / 10 : Math.round(between(0, 1.2) * 10) / 10,
      noise: Math.round(between(0.01, hard ? 0.09 : 0.05) * 1000) / 1000,
      shadow: Math.round(between(0, 0.5) * 100) / 100,
    });
  }
  return out;
}

export interface MethodScore {
  reported: boolean;
  heartRateBpm: number | null;
  hrError: number | null;
  rrMae: number | null;
  snrDb: number | null;
}

/** The scored part of one case. Synthetic cases add their StripParams; held-out images have none. */
export interface ScoredCase {
  referenceHr: number;
  kymora: MethodScore;
  baseline: MethodScore;
}

export interface CaseResult extends ScoredCase {
  params: StripParams;
}

export function rrMae(rPeaksMs: number[], ref: Reference): number | null {
  const errs: number[] = [];
  for (let i = 0; i + 1 < rPeaksMs.length; i++) {
    const e = rPeaksMs[i] / 1000;
    let k = -1;
    let best = Infinity;
    ref.rPeaksS.forEach((r, j) => {
      const d = Math.abs(r - e);
      if (d < best) {
        best = d;
        k = j;
      }
    });
    if (k < 0 || best > 0.15 || k + 1 >= ref.rPeaksS.length) continue;
    const refRr = ref.rPeaksS[k + 1] - ref.rPeaksS[k];
    errs.push(Math.abs(rPeaksMs[i + 1] / 1000 - e - refRr) * 1000);
  }
  return errs.length ? errs.reduce((a, b) => a + b, 0) / errs.length : null;
}

export function snrDb(est: Signal, ref: Reference): number | null {
  if (est.mv.length < est.fs) return null;
  let best: number | null = null;
  const maxLag = Math.round(0.06 * ref.fs);
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < est.mv.length; i++) {
      const t = est.t0 + i / est.fs;
      const j = Math.round(t * ref.fs) + lag;
      if (j >= 0 && j < ref.mv.length) pairs.push([ref.mv[j], est.mv[i]]);
    }
    if (pairs.length < ref.fs) continue;
    const mr = pairs.reduce((a, p) => a + p[0], 0) / pairs.length;
    const me = pairs.reduce((a, p) => a + p[1], 0) / pairs.length;
    let sig = 0;
    let err = 0;
    for (const [r, e] of pairs) {
      sig += (r - mr) ** 2;
      err += (r - mr - (e - me)) ** 2;
    }
    if (err === 0) continue;
    const snr = 10 * Math.log10(sig / err);
    if (best === null || snr > best) best = snr;
  }
  return best;
}

function score(m: Measurement | BaselineMeasurement, reported: boolean, ref: Reference): MethodScore {
  const hr = reported ? m.heartRateBpm : null;
  return {
    reported: reported && hr !== null,
    heartRateBpm: hr,
    hrError: hr === null ? null : hr - ref.heartRateBpm,
    rrMae: reported ? rrMae(m.rPeaksMs, ref) : null,
    snrDb: reported ? snrDb(m.signal, ref) : null,
  };
}

export interface StripRun {
  reference: Reference;
  kymora: Measurement;
  baseline: BaselineMeasurement;
}

/** Render one strip and run both methods on it. Used by the bench, result pages and the landing scene. */
export function runStrip(params: StripParams): StripRun {
  const raster = renderStrip(params);
  return { reference: referenceFor(params), kymora: digitize(raster), baseline: baselineDigitize(raster) };
}

export function evaluateCase(params: StripParams): CaseResult {
  const run = runStrip(params);
  return {
    params,
    referenceHr: run.reference.heartRateBpm,
    kymora: score(run.kymora, run.kymora.accepted, run.reference),
    baseline: score(run.baseline, true, run.reference),
  };
}

/** Moves a measurement from image time into reference time (subtracts shiftS from every time stamp). */
function toReferenceTime<M extends Measurement | BaselineMeasurement>(m: M, shiftS: number): M {
  if (!shiftS) return m;
  return {
    ...m,
    rPeaksMs: m.rPeaksMs.map((t) => t - shiftS * 1000),
    signal: { ...m.signal, t0: m.signal.t0 - shiftS },
  };
}

/**
 * Scores one decoded image (a held-out PTB-XL strip) with the same score() the
 * synthetic bench uses. traceStartS is where the reference's t = 0 sits on the image,
 * in seconds from its left edge. Shifting the reference by +traceStartS onto image
 * time is done as the equivalent shift of each estimate by -traceStartS, identically
 * for Kymora and the baseline, because snrDb indexes the reference waveform by time.
 */
export function evaluateRaster(raster: Raster, reference: Reference, traceStartS = 0): ScoredCase {
  const kymora = digitize(raster);
  const baseline = baselineDigitize(raster);
  return {
    referenceHr: reference.heartRateBpm,
    kymora: score(toReferenceTime(kymora, traceStartS), kymora.accepted, reference),
    baseline: score(toReferenceTime(baseline, traceStartS), true, reference),
  };
}

export interface Row {
  method: string;
  n: number;
  hrMae: number | null;
  rrMae: number | null;
  snrDb: number | null;
  rejectionRate: number;
}

export interface BenchSummary<C extends ScoredCase = CaseResult> {
  seed: number;
  n: number;
  rows: Row[];
  /** Signed HR error histograms, 2 bpm bins from -12 to +12 plus two overflow bins. */
  histogram: { edges: number[]; kymora: number[]; baseline: number[] };
  cases: C[];
}

const mean = (xs: Array<number | null>) => {
  const v = xs.filter((x): x is number => x !== null && Number.isFinite(x));
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 : null;
};

function row(method: string, cases: ScoredCase[], pick: (c: ScoredCase) => MethodScore): Row {
  const reported = cases.filter((c) => pick(c).reported);
  return {
    method,
    n: reported.length,
    hrMae: mean(reported.map((c) => (pick(c).hrError === null ? null : Math.abs(pick(c).hrError as number)))),
    rrMae: mean(reported.map((c) => pick(c).rrMae)),
    snrDb: mean(reported.map((c) => pick(c).snrDb)),
    rejectionRate: cases.length ? Math.round((1 - reported.length / cases.length) * 1000) / 1000 : 0,
  };
}

export const HIST_EDGES = [-12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12];

function histogram(errors: Array<number | null>): number[] {
  const bins = new Array(HIST_EDGES.length + 1).fill(0);
  for (const e of errors) {
    if (e === null) continue;
    let k = HIST_EDGES.findIndex((edge) => e < edge);
    if (k < 0) k = HIST_EDGES.length;
    bins[k] += 1;
  }
  return bins;
}

export function summarize<C extends ScoredCase = CaseResult>(seed: number, cases: C[]): BenchSummary<C> {
  const accepted = cases.filter((c) => c.kymora.reported);
  return {
    seed,
    n: cases.length,
    rows: [
      row("Kymora (grid calibration + quality gate)", cases, (c) => c.kymora),
      row("Baseline (300 DPI assumed, darkest pixel)", cases, (c) => c.baseline),
      row("Baseline on the strips Kymora accepted", accepted, (c) => c.baseline),
    ],
    histogram: {
      edges: HIST_EDGES,
      kymora: histogram(cases.map((c) => c.kymora.hrError)),
      baseline: histogram(cases.map((c) => c.baseline.hrError)),
    },
    cases,
  };
}

/** Runs the bench one strip at a time, yielding between strips so a UI can paint progress. */
export async function runBench(opts: { seed?: number; n?: number; onProgress?: (done: number, total: number) => void } = {}): Promise<BenchSummary> {
  const seed = opts.seed ?? BENCH_DEFAULTS.seed;
  const n = opts.n ?? BENCH_DEFAULTS.n;
  const strips = benchStrips(seed, n);
  const cases: CaseResult[] = [];
  for (let i = 0; i < strips.length; i++) {
    cases.push(evaluateCase(strips[i]));
    opts.onProgress?.(i + 1, strips.length);
    await new Promise((r) => setTimeout(r, 0));
  }
  return summarize(seed, cases);
}

const fmt = (v: number | null, d = 1) => (v === null ? "n/a" : v.toFixed(d));

export function formatTable(s: BenchSummary<ScoredCase>, title?: string): string {
  const head = title ?? `Kymora synthetic bench: seed ${s.seed}, ${s.n} strips`;
  const cols = ["method", "n", "HR MAE (bpm)", "RR MAE (ms)", "SNR (dB)", "rejected"];
  const lines = s.rows.map((r) => [r.method, String(r.n), fmt(r.hrMae, 2), fmt(r.rrMae, 1), fmt(r.snrDb, 2), `${(r.rejectionRate * 100).toFixed(1)}%`]);
  const widths = cols.map((c, i) => Math.max(c.length, ...lines.map((l) => l[i].length)));
  const pad = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join("  ");
  return [head, "", pad(cols), pad(widths.map((w) => "-".repeat(w))), ...lines.map(pad)].join("\n");
}
