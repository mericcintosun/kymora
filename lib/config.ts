/**
 * The single configuration module. Apart from next.config.ts and lib/brand-files.ts
 * (build-time brand files), this is the only file that reads process.env.
 *
 * There are no outbound calls in Kymora, so there are no timeout or retry constants.
 * Imports elsewhere in lib/ and scripts/ stay relative so tsx resolves them.
 */

export type AdapterModeSetting = "fake" | "real";

/** Reads ADAPTER_MODE at call time, so tests and the selector see the current value. */
export function readAdapterMode(): AdapterModeSetting {
  return process.env.ADAPTER_MODE === "real" ? "real" : "fake";
}

/** ADAPTER_MODE as set when this module was first loaded. Anything but "real" means "fake". */
export const ADAPTER_MODE: AdapterModeSetting = readAdapterMode();

/** The held-out PTB-XL fold 10 set. Paths are relative to the repo root (process.cwd()). */
export const HELD_OUT = {
  dir: "data/ptbxl-fold10",
  manifestPath: "data/ptbxl-fold10/manifest.json",
  resultsPath: "eval/ptbxl-results.json",
  maxRecords: 300,
  seed: 42,
} as const;

export const LOG_PREFIX = "[core]";
