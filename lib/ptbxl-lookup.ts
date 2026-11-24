/**
 * The PTB-XL reference lookup for dropped photos.
 *
 * loadPtbxlLookup is server only (it reads eval/ptbxl-lookup.json with node:fs). It
 * follows lib/held-out.ts: cached per path, never throws, never logs file contents,
 * and names the reason when there is no lookup. ecgIdFromFilename is pure and lives
 * in lib/ecg-id.ts so the client workspace can import it without node:fs.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { HELD_OUT, LOG_PREFIX } from "./config";
import type { ErrorCode } from "./errors";
import { ptbxlLookupSchema, type PtbxlLookup } from "./schemas";

export { ecgIdFromFilename } from "./ecg-id";

export type LookupLoad = { lookup: PtbxlLookup; reason: null } | { lookup: null; reason: ErrorCode };

const cache = new Map<string, LookupLoad>();

function unavailable(reason: ErrorCode): LookupLoad {
  console.log(`${LOG_PREFIX} ptbxl lookup unavailable reason=${reason}`);
  return { lookup: null, reason };
}

function read(path: string): LookupLoad {
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
  const parsed = ptbxlLookupSchema.safeParse(json);
  if (!parsed.success) return unavailable("invalid_input");
  console.log(`${LOG_PREFIX} ptbxl lookup loaded n=${Object.keys(parsed.data.records).length}`);
  return { lookup: parsed.data, reason: null };
}

/** Reads and validates the lookup file once per path and process. */
export function loadPtbxlLookup(path: string = HELD_OUT.lookupPath): LookupLoad {
  const hit = cache.get(path);
  if (hit) return hit;
  let result: LookupLoad;
  try {
    result = read(path);
  } catch {
    result = unavailable("parse_failure");
  }
  cache.set(path, result);
  return result;
}
