/**
 * npm run demo:reset
 *
 * Gets the demo into a known state and proves it is deterministic. Kymora keeps no
 * server state, so "reset" means: print the seed, rerun the two demo strips three times
 * each and require identical results, check the accept and refuse outcomes the demo
 * script relies on, and report whether the committed PTB-XL files load. Writes nothing
 * to disk. Exits 1 on any failed check, 0 otherwise.
 */
import { fakeAdapter } from "../lib/adapter";
import { loadHeldOutStatus } from "../lib/held-out";
import { CONFIG, digitize, type Measurement } from "../lib/kymora/pipeline";
import { renderStrip } from "../lib/kymora/synth";
import { loadPtbxlLookup } from "../lib/ptbxl-lookup";

const REFUSED_ID = "blurred-75-motion";
const RUNS = 3;
let failures = 0;

function check(ok: boolean, line: string): void {
  console.log(`${ok ? "ok  " : "FAIL"} ${line}`);
  if (!ok) failures++;
}

/** The measurement as JSON without runtimeMs, the one field that depends on the machine's clock. */
function fingerprint(m: Measurement): string {
  const { runtimeMs: _ignored, ...rest } = m;
  void _ignored;
  return JSON.stringify(rest);
}

// 1. Seed: the strips are generated from fixed integer seeds, so there is nothing to write.
const summaries = fakeAdapter.listSummaries();
console.log(`seed: ${summaries.length} synthetic strips`);
for (const s of summaries) console.log(`  ${s.id}`);
console.log(`featured: ${fakeAdapter.featuredStripId}`);

// 2. Determinism and outcomes on the two strips the demo shows.
const results = new Map<string, Measurement>();
for (const id of [fakeAdapter.featuredStripId, REFUSED_ID]) {
  const strip = fakeAdapter.getStrip(id);
  if (!strip) {
    check(false, `${id} is a seeded strip`);
    continue;
  }
  const runs: Measurement[] = [];
  for (let i = 0; i < RUNS; i++) runs.push(digitize(renderStrip(strip.params)));
  const prints = runs.map(fingerprint);
  check(prints.every((p) => p === prints[0]), `${id}: ${RUNS} runs give identical results`);
  results.set(id, runs[0]);
}

const featured = results.get(fakeAdapter.featuredStripId);
if (featured) {
  check(
    featured.accepted && featured.heartRateBpm !== null,
    featured.accepted
      ? `${fakeAdapter.featuredStripId}: accepted, ${featured.heartRateBpm !== null ? featured.heartRateBpm.toFixed(0) : "no"} bpm, mean RR ${featured.meanRrMs !== null ? featured.meanRrMs.toFixed(0) : "none"} ms, grid ${featured.pxPerMmX} px/mm`
      : `${fakeAdapter.featuredStripId}: expected accepted, got refused (quality ${featured.quality.toFixed(2)}, grid ${featured.pxPerMmX} px/mm): ${featured.reasons.join(" ")}`
  );
}
const refused = results.get(REFUSED_ID);
if (refused) {
  check(
    !refused.accepted && refused.quality < CONFIG.qualityThreshold,
    `${REFUSED_ID}: refused, quality ${refused.quality.toFixed(2)} against the ${CONFIG.qualityThreshold} gate`
  );
}

// 3. Committed PTB-XL files: each either parses or fails with a named reason code.
const heldOut = loadHeldOutStatus();
check(
  heldOut.results !== null || heldOut.reason !== null,
  heldOut.results ? `held-out results: parsed, n=${heldOut.results.n}` : `held-out results: not loaded, reason=${heldOut.reason}`
);
const lookup = loadPtbxlLookup();
check(
  lookup.lookup !== null || lookup.reason !== null,
  lookup.lookup ? `ptbxl lookup: parsed, ${Object.keys(lookup.lookup.records).length} records` : `ptbxl lookup: not loaded, reason=${lookup.reason}`
);

// 4. Visitor state.
console.log("server state: none to clear. Kymora has no database and no server writes.");
console.log("visitor state: dropped photo results live in the tab's sessionStorage (kymora:<id>). Open a private window for a clean start.");

if (failures > 0) {
  console.log(`demo:reset: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("demo:reset: all checks passed");
