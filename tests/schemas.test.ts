import assert from "node:assert/strict";
import { test } from "node:test";
import { heldOutResultsSchema, manifestSchema, referenceFileSchema, stripIdSchema } from "../lib/schemas";

const record = {
  file: "images/00009.png",
  ecgId: 9,
  fs: 100,
  traceStartS: 0.2,
  rPeaksS: [0.41, 1.25, 2.08],
  heartRateBpm: 72.3,
  meanRrMs: 830,
  mvFile: "reference/00009.json",
};
const manifest = { renderer: "matplotlib", seed: 42, config: { paperSpeedMmPerS: 25 }, records: [record] };

const row = (method: string) => ({ method, n: 1, hrMae: 1.5, rrMae: 12, snrDb: null, rejectionRate: 0 });
const results = {
  generatedAt: "2026-11-24T12:00:00.000Z",
  renderer: "ecg-image-kit",
  seed: 42,
  n: 1,
  config: { qualityThreshold: 0.6 },
  rows: [row("Kymora"), row("Baseline"), row("Baseline on accepted")],
  histogram: { edges: [-2, 0, 2], kymora: [0, 1, 0, 0], baseline: [0, 0, 1, 0] },
  perRecord: [{ ecgId: 9, referenceBpm: 72.3, kymoraBpm: 73.8, baselineBpm: null }],
};

test("manifestSchema accepts a valid manifest", () => {
  assert.equal(manifestSchema.safeParse(manifest).success, true);
});

test("manifestSchema rejects a wrong type and a missing traceStartS", () => {
  assert.equal(manifestSchema.safeParse({ ...manifest, records: [{ ...record, ecgId: "9" }] }).success, false);
  const { traceStartS: _dropped, ...noStart } = record;
  assert.equal(manifestSchema.safeParse({ ...manifest, records: [noStart] }).success, false);
  assert.equal(manifestSchema.safeParse({ ...manifest, renderer: "paint" }).success, false);
});

test("referenceFileSchema accepts fs and mv, rejects an empty waveform", () => {
  assert.equal(referenceFileSchema.safeParse({ fs: 100, mv: [0.1, 0.2] }).success, true);
  assert.equal(referenceFileSchema.safeParse({ fs: 100, mv: [] }).success, false);
});

test("heldOutResultsSchema accepts a valid file and rejects a wrong type", () => {
  assert.equal(heldOutResultsSchema.safeParse(results).success, true);
  assert.equal(heldOutResultsSchema.safeParse({ ...results, n: "1" }).success, false);
  assert.equal(heldOutResultsSchema.safeParse({ ...results, rows: results.rows.slice(0, 2) }).success, false);
});

test("stripIdSchema accepts seeded ids and rejects bad ones", () => {
  assert.equal(stripIdSchema.safeParse("sinus-72-tilted").success, true);
  for (const bad of ["", "../etc/passwd", "Sinus 72", "double--hyphen", "-lead", "x".repeat(65)]) {
    assert.equal(stripIdSchema.safeParse(bad).success, false, bad);
  }
});
