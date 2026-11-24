/**
 * Server-only loader for the committed held-out results (eval/ptbxl-results.json,
 * written by `npm run eval -- --set ptbxl`). Never import this from a client component.
 *
 * It never throws and never logs file contents: a missing file, bad JSON or a wrong
 * shape returns null and logs one line with the reason code.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { HELD_OUT, LOG_PREFIX } from "./config";
import type { ErrorCode } from "./errors";
import { heldOutResultsSchema, type HeldOutResults } from "./schemas";

const cache = new Map<string, HeldOutResults | null>();

function unavailable(reason: ErrorCode): null {
  console.log(`${LOG_PREFIX} held-out unavailable reason=${reason}`);
  return null;
}

function read(path: string): HeldOutResults | null {
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), path), "utf8");
  } catch {
    return unavailable("not_configured");
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return unavailable("parse_failure");
  }
  const parsed = heldOutResultsSchema.safeParse(json);
  if (!parsed.success) return unavailable("invalid_input");
  console.log(`${LOG_PREFIX} held-out loaded n=${parsed.data.n} renderer=${parsed.data.renderer}`);
  return parsed.data;
}

/** Reads and validates the results file once per path and process. */
export function loadHeldOutResults(path: string = HELD_OUT.resultsPath): HeldOutResults | null {
  if (cache.has(path)) return cache.get(path) ?? null;
  let result: HeldOutResults | null;
  try {
    result = read(path);
  } catch {
    result = unavailable("parse_failure");
  }
  cache.set(path, result);
  return result;
}
