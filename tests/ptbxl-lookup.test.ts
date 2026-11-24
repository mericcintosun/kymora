import assert from "node:assert/strict";
import { test } from "node:test";
import { makeRealAdapter } from "../lib/adapter-real";
import { fakeAdapter } from "../lib/adapter";
import { fileKey } from "../lib/file-key";
import { ecgIdFromFilename, loadPtbxlLookup } from "../lib/ptbxl-lookup";
import { ptbxlLookupSchema } from "../lib/schemas";

test("ecgIdFromFilename: accepts the PTB-XL naming variants", () => {
  assert.equal(ecgIdFromFilename("00009.png"), 9);
  assert.equal(ecgIdFromFilename("9.jpg"), 9);
  assert.equal(ecgIdFromFilename("ecg_00009_photo.jpeg"), 9);
  assert.equal(ecgIdFromFilename("IMG_00009 (1).png"), 9);
  assert.equal(ecgIdFromFilename("21837.png"), 21837);
});

test("ecgIdFromFilename: rejects names with no digits and phone camera date names", () => {
  assert.equal(ecgIdFromFilename("strip.png"), null);
  assert.equal(ecgIdFromFilename(""), null);
  assert.equal(ecgIdFromFilename("IMG_20241103.jpg"), null);
  assert.equal(ecgIdFromFilename("PXL_20241103_101500.jpg"), null);
  assert.equal(ecgIdFromFilename("00000.png"), null);
});

test("loadPtbxlLookup: a missing file gives no lookup and reason not_configured", () => {
  const r = loadPtbxlLookup("eval/this-lookup-does-not-exist.json");
  assert.equal(r.lookup, null);
  assert.equal(r.reason, "not_configured");
});

test("ptbxlLookupSchema: accepts number-string keys, rejects other keys", () => {
  const ok = { source: "PTB-XL fold 10", records: { "9": { heartRateBpm: 72, meanRrMs: 833.3 } } };
  assert.equal(ptbxlLookupSchema.safeParse(ok).success, true);
  const bad = { source: "PTB-XL fold 10", records: { "00009": { heartRateBpm: 72, meanRrMs: 833.3 } } };
  assert.equal(ptbxlLookupSchema.safeParse(bad).success, false);
});

test("getReferenceLookup: the fake adapter has none", () => {
  assert.equal(fakeAdapter.getReferenceLookup(), null);
});

test("getReferenceLookup: the real adapter exists on the interface and returns a lookup or null", () => {
  const heldOut = {
    generatedAt: "2026-11-24T00:00:00Z",
    renderer: "matplotlib" as const,
    seed: 42,
    n: 1,
    config: {},
    rows: [],
    histogram: { edges: [], kymora: [], baseline: [] },
    perRecord: [],
  };
  const lookup = makeRealAdapter(heldOut).getReferenceLookup();
  assert.ok(lookup === null || ptbxlLookupSchema.safeParse(lookup).success);
});

test("fileKey: same file gives the same key, a changed file a different one", () => {
  const a = { name: "00009.png", size: 1234, lastModified: 1700000000000 };
  assert.equal(fileKey(a), fileKey({ ...a }));
  assert.notEqual(fileKey(a), fileKey({ ...a, size: 1235 }));
  assert.notEqual(fileKey(a), fileKey({ ...a, lastModified: 1700000000001 }));
});
