/**
 * The data seam and the adapter selector. Pages and API routes call getAdapter(); this
 * is the only file that branches on ADAPTER_MODE. Server side only.
 *
 *   ADAPTER_MODE=real and eval/ptbxl-results.json valid  -> real adapter (held-out results)
 *   anything else                                         -> fake adapter (seeded synthetic strips)
 *
 * Imports are relative so `tsx scripts/seed.ts` resolves them without path aliases.
 */
import { fakeAdapter, type KymoraAdapter } from "./adapter-fake";
import { makeRealAdapter } from "./adapter-real";
import { LOG_PREFIX, readAdapterMode, type AdapterModeSetting } from "./config";
import type { ErrorCode } from "./errors";
import { loadHeldOutResults } from "./held-out";
import type { HeldOutResults } from "./schemas";
import type { AdapterMode } from "./types";

export { fakeAdapter };
export type { KymoraAdapter };

let loggedFallback = false;

/** Pure selection rule, exported for the tests. Reason is set when the result is the fake adapter. */
export function selectAdapter(mode: AdapterModeSetting, heldOut: HeldOutResults | null): { adapter: KymoraAdapter; reason: ErrorCode | null } {
  if (mode !== "real") return { adapter: fakeAdapter, reason: "not_configured" };
  if (!heldOut) return { adapter: fakeAdapter, reason: "not_configured" };
  return { adapter: makeRealAdapter(heldOut), reason: null };
}

export function getAdapter(): KymoraAdapter {
  const mode = readAdapterMode();
  const { adapter, reason } = selectAdapter(mode, mode === "real" ? loadHeldOutResults() : null);
  if (reason && !loggedFallback) {
    loggedFallback = true;
    console.log(`${LOG_PREFIX} adapter fake reason=${reason}`);
  }
  return adapter;
}

/** The mode that actually answers (after the fallback), not the requested one. */
export function adapterMode(): AdapterMode {
  return getAdapter().mode;
}
