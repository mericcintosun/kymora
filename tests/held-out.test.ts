/**
 * Scoring tests on hand-built fixtures: rrMae, snrDb, summarize and formatTable are
 * the functions both the synthetic bench and the PTB-XL path go through.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { formatTable, rrMae, snrDb, summarize, type CaseResult, type MethodScore } from "../lib/kymora/bench";
import type { Reference, StripParams } from "../lib/kymora/synth";

const FS = 100;
const mv = Array.from({ length: 5 * FS }, (_, i) => Math.sin((2 * Math.PI * i) / FS));
const ref: Reference = { fs: FS, mv, rPeaksS: [1, 2, 3, 4], heartRateBpm: 60, meanRrMs: 1000 };

test("rrMae: a perfect estimate has zero RR error", () => {
  assert.equal(rrMae([1000, 2000, 3000, 4000], ref), 0);
});

test("rrMae: a shifted peak gives a known RR error", () => {
  // Intervals 1050 ms and 950 ms against a true 1000 ms: 50 ms each.
  const e = rrMae([1000, 2050, 3000], ref);
  assert.ok(e !== null && Math.abs(e - 50) < 1e-6, `got ${e}`);
});

test("rrMae: a detection more than 150 ms from any true peak is skipped", () => {
  // 1300 ms is 300 ms from the nearest true peak, so only the 2000 -> 3050 interval counts.
  const e = rrMae([1300, 2000, 3050], ref);
  assert.ok(e !== null && Math.abs(e - 50) < 1e-6, `got ${e}`);
  assert.equal(rrMae([], ref), null);
  assert.equal(rrMae([1000], ref), null);
});

test("snrDb: a near-perfect estimate scores high, a too-short one gives null", () => {
  const est = { fs: FS, t0: 0, mv: mv.map((v, i) => v + (i % 2 ? 0.001 : -0.001)) };
  const snr = snrDb(est, ref);
  assert.ok(snr !== null && snr > 40, `got ${snr}`);
  assert.equal(snrDb({ fs: FS, t0: 0, mv: mv.slice(0, FS - 1) }, ref), null);
});

const params: StripParams = { seed: 1, heartRateBpm: 72, rrJitterMs: 20, pxPerMm: 6, skewDeg: 0, blurPx: 0, noise: 0.02, shadow: 0 };
const ms = (reported: boolean, hrError: number | null, rr: number | null, snr: number | null): MethodScore => ({
  reported,
  heartRateBpm: hrError === null ? null : 72 + hrError,
  hrError,
  rrMae: rr,
  snrDb: snr,
});
const cases: CaseResult[] = [
  { params, referenceHr: 72, kymora: ms(true, -2, 10, 20), baseline: ms(true, 10, 50, 5) },
  { params, referenceHr: 72, kymora: ms(true, 4, 20, 10), baseline: ms(true, -6, 30, 7) },
  { params, referenceHr: 72, kymora: ms(false, null, null, null), baseline: ms(true, 20, 100, 1) },
];

test("summarize: means and rejection rate over three hand-built cases", () => {
  const s = summarize(42, cases);
  const [k, b, bAccepted] = s.rows;
  assert.equal(s.n, 3);
  assert.deepEqual([k.n, k.hrMae, k.rrMae, k.snrDb, k.rejectionRate], [2, 3, 15, 15, 0.333]);
  assert.deepEqual([b.n, b.hrMae, b.rrMae, b.snrDb, b.rejectionRate], [3, 12, 60, 4.33, 0]);
  assert.deepEqual([bAccepted.n, bAccepted.hrMae, bAccepted.rrMae, bAccepted.snrDb], [2, 8, 40, 6]);
  assert.equal(s.histogram.kymora.reduce((a, x) => a + x, 0), 2);
  assert.equal(s.histogram.baseline.reduce((a, x) => a + x, 0), 3);
});

test("formatTable: contains all three row labels", () => {
  const table = formatTable(summarize(42, cases));
  for (const label of [
    "Kymora (grid calibration + quality gate)",
    "Baseline (300 DPI assumed, darkest pixel)",
    "Baseline on the strips Kymora accepted",
  ]) {
    assert.ok(table.includes(label), `missing ${label}`);
  }
});
