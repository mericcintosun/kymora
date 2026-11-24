/**
 * npm run proof
 *
 * Runs the reproducible proofs and rewrites the matching README.md blocks between
 * <!-- PROOF:BEGIN <name> --> and <!-- PROOF:END <name> -->:
 *
 *   eval-synthetic  npm run eval -- --seed 42 --n 60 --out eval/proof-synthetic.json
 *   eval-ptbxl      the rows of the committed eval/ptbxl-results.json, if present
 *   tests           the pass or fail summary of npm test
 *   demo-reset      the check lines of npm run demo:reset (determinism, accept, refuse)
 *
 * Uses only node: modules and node_modules/.bin/tsx. Never throws, always exits 0,
 * prints one summary line per proof and writes nothing outside the repo.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const README = join(ROOT, "README.md");
const SUBMISSION = join(ROOT, "SUBMISSION.md");
const TSX = join(ROOT, "node_modules", ".bin", process.platform === "win32" ? "tsx.cmd" : "tsx");
const TIMEOUT_MS = 90_000;

function run(args) {
  try {
    const stdout = execFileSync(TSX, args, { cwd: ROOT, timeout: TIMEOUT_MS, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, stdout };
  } catch (e) {
    const timedOut = e && (e.signal === "SIGTERM" || e.code === "ETIMEDOUT");
    return {
      ok: false,
      stdout: String((e && e.stdout) || ""),
      reason: timedOut ? `timed out after ${TIMEOUT_MS / 1000} s` : String((e && e.stderr) || (e && e.message) || "unknown error").trim().split("\n")[0],
    };
  }
}

function fence(lines) {
  return ["```text", ...lines, "```"].join("\n");
}

function proofSynthetic() {
  if (!existsSync(TSX)) return { body: "Not run in this build: node_modules/.bin/tsx is missing (run npm install first).", line: "not run (tsx missing)" };
  const r = run(["scripts/eval.ts", "--seed", "42", "--n", "60", "--out", "eval/proof-synthetic.json"]);
  if (!r.ok) return { body: `Not run in this build: npm run eval failed (${r.reason}).`, line: `failed (${r.reason})` };
  const lines = r.stdout.split("\n");
  const start = lines.findIndex((l) => l.startsWith("Kymora synthetic bench"));
  const config = lines.find((l) => l.startsWith("config:"));
  if (start < 0 || !config) return { body: "Not run in this build: npm run eval printed no table.", line: "failed (no table in output)" };
  const table = [];
  for (let i = start; i < lines.length && !lines[i].startsWith("config:"); i++) table.push(lines[i]);
  while (table.length && table[table.length - 1].trim() === "") table.pop();
  return {
    body: `Command: \`npm run eval -- --seed 42 --n 60 --out eval/proof-synthetic.json\`\n\n${fence([...table, "", config])}`,
    line: `ok (${table[0]})`,
  };
}

const fmt = (v, d) => (typeof v === "number" ? v.toFixed(d) : "n/a");

function proofPtbxl() {
  const path = join(ROOT, "eval", "ptbxl-results.json");
  const missing = "Not run in this build: data/ptbxl-fold10 has not been generated (needs Python, wfdb and a local PTB-XL copy).";
  if (!existsSync(path)) return { body: missing, line: "not run (eval/ptbxl-results.json missing)" };
  let data;
  try {
    data = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return { body: "Not run in this build: eval/ptbxl-results.json is not valid JSON.", line: "not run (invalid JSON)" };
  }
  if (!data || !Array.isArray(data.rows) || typeof data.n !== "number" || typeof data.renderer !== "string") {
    return { body: "Not run in this build: eval/ptbxl-results.json is not in the expected shape.", line: "not run (wrong shape)" };
  }
  const cols = ["method", "n", "HR MAE (bpm)", "RR MAE (ms)", "SNR (dB)", "rejected"];
  const rows = data.rows.map((r) => [String(r.method), String(r.n), fmt(r.hrMae, 2), fmt(r.rrMae, 1), fmt(r.snrDb, 2), `${fmt(r.rejectionRate * 100, 1)}%`]);
  const widths = cols.map((c, i) => Math.max(c.length, ...rows.map((l) => l[i].length)));
  const pad = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join("  ");
  const head = `PTB-XL fold 10: ${data.n} images, renderer ${data.renderer}, seed ${data.seed}, generated ${data.generatedAt}`;
  return {
    body: `From the committed results file \`eval/ptbxl-results.json\` (written by \`npm run eval -- --set ptbxl\`):\n\n${fence([head, "", pad(cols), pad(widths.map((w) => "-".repeat(w))), ...rows.map(pad)])}`,
    line: `ok (from the committed results file, n=${data.n}, renderer ${data.renderer})`,
  };
}

function proofTests() {
  if (!existsSync(TSX)) return { body: "Not run in this build: node_modules/.bin/tsx is missing (run npm install first).", line: "not run (tsx missing)" };
  const dir = join(ROOT, "tests");
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".test.ts")).sort().map((f) => join("tests", f)) : [];
  if (!files.length) return { body: "Not run in this build: no tests/*.test.ts files.", line: "not run (no test files)" };
  const r = run(["--test", "--test-reporter=tap", ...files]);
  const count = (name) => {
    const m = r.stdout.match(new RegExp(`^# ${name} (\\d+)`, "m"));
    return m ? Number(m[1]) : null;
  };
  const tests = count("tests");
  const pass = count("pass");
  const failed = count("fail");
  if (tests === null) return { body: `Not run in this build: npm test produced no summary (${r.reason || "no output"}).`, line: "not run (no summary)" };
  const summary = `npm test: ${tests} tests, ${pass} passed, ${failed} failed (${files.length} files, node:test via tsx)`;
  return { body: fence([summary]), line: failed === 0 ? `ok (${summary})` : `FAILED (${summary})` };
}

function proofDemoReset() {
  if (!existsSync(TSX)) return { body: "Not run in this build: node_modules/.bin/tsx is missing (run npm install first).", line: "not run (tsx missing)" };
  const r = run(["scripts/reset.ts"]);
  const checks = r.stdout.split("\n").filter((l) => l.startsWith("ok  ") || l.startsWith("FAIL"));
  if (!checks.length) return { body: `Not run in this build: npm run demo:reset printed no checks (${r.reason || "no output"}).`, line: "not run (no checks)" };
  const failed = checks.filter((l) => l.startsWith("FAIL")).length;
  const summary = `npm run demo:reset: ${checks.length} checks, ${failed} failed`;
  return { body: fence([summary, "", ...checks]), line: failed === 0 && r.ok ? `ok (${summary})` : `FAILED (${summary})` };
}

function rewrite(readme, name, body) {
  const begin = `<!-- PROOF:BEGIN ${name} -->`;
  const end = `<!-- PROOF:END ${name} -->`;
  const a = readme.indexOf(begin);
  const b = readme.indexOf(end);
  if (a < 0 || b < a) return { readme, found: false };
  return { readme: `${readme.slice(0, a + begin.length)}\n${body}\n${readme.slice(b)}`, found: true };
}

function main() {
  let readme;
  try {
    readme = readFileSync(README, "utf8");
  } catch {
    console.log("proof: README.md not readable, nothing written");
    return;
  }
  const proofs = [
    ["eval-synthetic", proofSynthetic],
    ["eval-ptbxl", proofPtbxl],
    ["tests", proofTests],
    ["demo-reset", proofDemoReset],
  ];
  const bodies = [];
  for (const [name, fn] of proofs) {
    let result;
    try {
      result = fn();
    } catch (e) {
      const reason = e instanceof Error ? e.message.split("\n")[0] : "unknown error";
      result = { body: `Not run in this build: ${reason}.`, line: `not run (${reason})` };
    }
    bodies.push([name, result.body]);
    const next = rewrite(readme, name, result.body);
    readme = next.readme;
    console.log(`proof ${name}: ${result.line}${next.found ? "" : " (README markers missing, block not written)"}`);
  }
  try {
    writeFileSync(README, readme);
  } catch {
    console.log("proof: could not write README.md");
  }

  // SUBMISSION.md carries copies of some of the same blocks, so the Devpost text never drifts from README.md.
  if (!existsSync(SUBMISSION)) return;
  try {
    let sub = readFileSync(SUBMISSION, "utf8");
    let written = 0;
    for (const [name, body] of bodies) {
      const next = rewrite(sub, name, body);
      sub = next.readme;
      if (next.found) written += 1;
    }
    writeFileSync(SUBMISSION, sub);
    console.log(`proof: SUBMISSION.md ${written} block(s) rewritten`);
  } catch {
    console.log("proof: could not update SUBMISSION.md");
  }
}

try {
  main();
} catch (e) {
  console.log(`proof: stopped early (${e instanceof Error ? e.message : "unknown error"})`);
}
process.exit(0);
