/**
 * npm run eval [-- --seed 42 --n 200 --out eval/results.json]
 * npm run eval -- --set ptbxl [--out eval/ptbxl-results.json]
 *
 * Runs the exact pipeline the web app uses (lib/kymora/pipeline.ts) against the
 * baseline and prints the table shown on /how. Deterministic for a given seed.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PNG } from "pngjs";
import { HELD_OUT } from "../lib/config";
import { evaluateRaster, formatTable, runBench, summarize, type ScoredCase } from "../lib/kymora/bench";
import { CONFIG, type Raster } from "../lib/kymora/pipeline";
import type { Reference } from "../lib/kymora/synth";
import { heldOutResultsSchema, manifestSchema, referenceFileSchema, type HeldOutResults, type ManifestRecord } from "../lib/schemas";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/** Stops with one plain sentence and exit code 1. */
function fail(sentence: string): never {
  console.error(sentence);
  process.exit(1);
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

function decodePng(path: string): Raster {
  const png = PNG.sync.read(readFileSync(path));
  return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.length) };
}

function referenceOf(rec: ManifestRecord): Reference {
  const file = referenceFileSchema.safeParse(readJson(join(HELD_OUT.dir, rec.mvFile)));
  if (!file.success) fail(`Reference file ${rec.mvFile} has the wrong shape. Regenerate the set with scripts/ptbxl/make_set.py.`);
  return { fs: file.data.fs, mv: file.data.mv, rPeaksS: rec.rPeaksS, heartRateBpm: rec.heartRateBpm, meanRrMs: rec.meanRrMs };
}

const RENDERER_LABEL = { "ecg-image-kit": "ECG-Image-Kit", matplotlib: "matplotlib (seeded fallback)" } as const;

/**
 * Held-out clinical set: PTB-XL fold 10 lead II strips, rendered by
 * scripts/ptbxl/make_set.py into data/ptbxl-fold10/. Each image is decoded with
 * pngjs and scored by evaluateRaster(), the same scoring code as the synthetic bench.
 */
async function evalPtbxl(out: string) {
  const started = Date.now();
  if (!existsSync(HELD_OUT.manifestPath)) {
    fail(`${HELD_OUT.manifestPath} does not exist: build the held-out set first with python scripts/ptbxl/make_set.py --ptbxl-root <path>.`);
  }
  const manifest = manifestSchema.safeParse(readJson(HELD_OUT.manifestPath));
  if (!manifest.success) {
    const where = manifest.error.issues[0]?.path.join(".") || "root";
    fail(`${HELD_OUT.manifestPath} is not a valid manifest (first problem at "${where}"): regenerate it with scripts/ptbxl/make_set.py.`);
  }
  const { renderer, seed, records: all } = manifest.data;
  const records = all.slice(0, HELD_OUT.maxRecords);
  const missing = records.filter((r) => !existsSync(join(HELD_OUT.dir, r.file)));
  if (missing.length) {
    fail(`${missing.length} of ${records.length} images are missing from ${HELD_OUT.dir}/images: they are gitignored, so render them with python scripts/ptbxl/make_set.py --ptbxl-root <path>.`);
  }
  if (seed !== HELD_OUT.seed) console.log(`note: manifest seed ${seed} differs from the documented seed ${HELD_OUT.seed}`);

  const cases: ScoredCase[] = [];
  for (let i = 0; i < records.length; i++) {
    const rec = records[i];
    cases.push(evaluateRaster(decodePng(join(HELD_OUT.dir, rec.file)), referenceOf(rec), rec.traceStartS));
    if ((i + 1) % 20 === 0 || i + 1 === records.length) process.stdout.write(`  ${i + 1}/${records.length} images\n`);
    await new Promise((r) => setTimeout(r, 0));
  }

  const summary = summarize(seed, cases);
  console.log("");
  console.log(formatTable(summary, `Kymora held-out set: PTB-XL fold 10, ${summary.n} images rendered by ${RENDERER_LABEL[renderer]}, seed ${seed}`));
  console.log(`\nrenderer: ${renderer}  seed: ${seed}  n: ${summary.n}`);
  console.log(`config: ${JSON.stringify(CONFIG)}`);
  console.log(`runtime: ${((Date.now() - started) / 1000).toFixed(1)} s`);

  const results: HeldOutResults = heldOutResultsSchema.parse({
    generatedAt: new Date().toISOString(),
    renderer,
    seed,
    n: summary.n,
    config: CONFIG,
    rows: summary.rows,
    histogram: summary.histogram,
    perRecord: cases.map((c, i) => ({
      ecgId: records[i].ecgId,
      referenceBpm: c.referenceHr,
      kymoraBpm: c.kymora.reported ? c.kymora.heartRateBpm : null,
      baselineBpm: c.baseline.heartRateBpm,
    })),
  });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(results, null, 2) + "\n");
  console.log(`wrote ${out}`);
}

async function evalSynthetic() {
  const seed = Number(arg("seed", "42"));
  const n = Number(arg("n", "200"));
  const out = arg("out", "eval/results.json");
  const started = Date.now();

  const summary = await runBench({
    seed,
    n,
    onProgress: (done, total) => {
      if (done % 20 === 0 || done === total) process.stdout.write(`  ${done}/${total} strips\n`);
    },
  });

  console.log("");
  console.log(formatTable(summary));
  console.log(`\nconfig: ${JSON.stringify(CONFIG)}`);
  console.log(`runtime: ${((Date.now() - started) / 1000).toFixed(1)} s`);

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), config: CONFIG, ...summary }, null, 2));
  console.log(`wrote ${out}`);
}

async function main() {
  const set = arg("set", "synthetic");
  if (set === "ptbxl") return evalPtbxl(arg("out", HELD_OUT.resultsPath));
  if (set !== "synthetic") fail(`Unknown --set "${set}": use synthetic (default) or ptbxl.`);
  return evalSynthetic();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
