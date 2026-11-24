/**
 * npm run eval [-- --seed 42 --n 200 --out eval/results.json] [-- --set ptbxl]
 *
 * Runs the exact pipeline the web app uses (lib/kymora/pipeline.ts) against the
 * baseline and prints the table shown on /how. Deterministic for a given seed.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { formatTable, runBench } from "../lib/kymora/bench";
import { CONFIG } from "../lib/kymora/pipeline";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/**
 * Held-out clinical set: PTB-XL fold 10 lead II strips rendered by ECG-Image-Kit.
 * TODO: swap this stub for the real loader once data/ptbxl-fold10/manifest.json exists
 * (one entry per image: file, ecg_id, reference R peaks in seconds, fs, lead II mV).
 * Decoding the PNGs needs an image decoder such as pngjs; the scoring functions in
 * lib/kymora/bench.ts (rrMae, snrDb) already take a reference in that shape.
 */
function loadPtbxlFold10(): never {
  throw new Error(
    "PTB-XL fold 10 set not generated yet. See README section 'Held-out set' for the wfdb + ECG-Image-Kit steps, then implement loadPtbxlFold10() in scripts/eval.ts."
  );
}

async function main() {
  const set = arg("set", "synthetic");
  if (set === "ptbxl") loadPtbxlFold10();

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

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
