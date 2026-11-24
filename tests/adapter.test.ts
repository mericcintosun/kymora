import assert from "node:assert/strict";
import { test } from "node:test";
import { getAdapter, selectAdapter } from "../lib/adapter";
import { loadHeldOutResults } from "../lib/held-out";
import { benchStrips, evaluateCase, summarize } from "../lib/kymora/bench";

test("ADAPTER_MODE unset gives the fake adapter", () => {
  const before = process.env.ADAPTER_MODE;
  delete process.env.ADAPTER_MODE;
  try {
    const adapter = getAdapter();
    assert.equal(adapter.mode, "fake");
    assert.equal(adapter.getHeldOut(), null);
    assert.equal(adapter.listStrips().length, 12);
  } finally {
    if (before !== undefined) process.env.ADAPTER_MODE = before;
  }
});

test("real with no results file falls back to fake", () => {
  const heldOut = loadHeldOutResults("eval/this-file-does-not-exist.json");
  assert.equal(heldOut, null);
  const { adapter, reason } = selectAdapter("real", heldOut);
  assert.equal(adapter.mode, "fake");
  assert.equal(reason, "not_configured");
});

test("seed 42 synthetic bench (n 8) is deterministic and its row counts are consistent", () => {
  const run = () => summarize(42, benchStrips(42, 8).map(evaluateCase));
  const a = run();
  const b = run();
  assert.deepEqual(a.rows, b.rows);
  assert.deepEqual(a.histogram, b.histogram);
  const [k, base, baseAccepted] = a.rows;
  assert.equal(a.n, 8);
  assert.ok(k.n <= 8 && base.n <= 8);
  assert.equal(baseAccepted.n <= k.n, true);
  assert.equal(k.rejectionRate, Math.round((1 - k.n / 8) * 1000) / 1000);
  assert.equal(a.histogram.kymora.reduce((s, x) => s + x, 0), k.n);
});
