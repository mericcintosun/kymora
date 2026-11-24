/**
 * npm run lookup
 *
 * Build-time script. Reads data/ptbxl-fold10/manifest.json (written by
 * scripts/ptbxl/make_set.py), validates it with manifestSchema, and writes the compact
 * eval/ptbxl-lookup.json: ecg_id to reference heart rate and mean RR. The workspace uses
 * it to show the PTB-XL reference next to a dropped photo named after its ecg_id.
 *
 * Without a manifest it prints one line and exits 0, writing nothing. A manifest that
 * fails validation exits 1 with the reason code. Running it twice writes the same file.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { HELD_OUT } from "../lib/config";
import type { ErrorCode } from "../lib/errors";
import { manifestSchema, ptbxlLookupSchema, type PtbxlLookup } from "../lib/schemas";

function fail(code: ErrorCode, hint: string): never {
  console.log(`lookup: ${code}, ${hint}`);
  process.exit(1);
}

const manifestPath = resolve(process.cwd(), HELD_OUT.manifestPath);
let raw: string;
try {
  raw = readFileSync(manifestPath, "utf8");
} catch {
  console.log(`lookup: no manifest at ${HELD_OUT.manifestPath}, nothing written. Build the set with scripts/ptbxl/make_set.py first.`);
  process.exit(0);
}

let json: unknown;
try {
  json = JSON.parse(raw);
} catch {
  fail("parse_failure", `${HELD_OUT.manifestPath} is not valid JSON.`);
}

const manifest = manifestSchema.safeParse(json);
if (!manifest.success) fail("invalid_input", `${HELD_OUT.manifestPath} does not match manifestSchema.`);

// Sorted by ecg_id so the file is byte-identical across runs.
const records: PtbxlLookup["records"] = {};
for (const r of [...manifest.data.records].sort((a, b) => a.ecgId - b.ecgId)) {
  records[String(r.ecgId)] = {
    heartRateBpm: Math.round(r.heartRateBpm * 10) / 10,
    meanRrMs: Math.round(r.meanRrMs * 10) / 10,
  };
}
const lookup: PtbxlLookup = {
  source: `PTB-XL fold 10, renderer ${manifest.data.renderer}, seed ${manifest.data.seed}`,
  records,
};
const checked = ptbxlLookupSchema.safeParse(lookup);
if (!checked.success) fail("invalid_input", "the lookup built from the manifest does not match ptbxlLookupSchema.");

const outPath = resolve(process.cwd(), HELD_OUT.lookupPath);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(checked.data, null, 2)}\n`);
console.log(`lookup: wrote ${HELD_OUT.lookupPath} with ${Object.keys(records).length} records (${lookup.source}).`);
