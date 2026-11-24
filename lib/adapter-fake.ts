/**
 * The fake adapter: the 12 seeded synthetic strips (lib/data.ts), measured by the real
 * pipeline. Labelled synthetic everywhere. It has no held-out results.
 *
 * Imports are relative so `tsx scripts/seed.ts` resolves them without path aliases.
 */
import { FEATURED_STRIP_ID, seedStrips, stripById, type StripSeed } from "./data/seed";
import { BENCH_DEFAULTS, benchStrips, evaluateCase, runStrip, summarize, type BenchSummary, type StripRun } from "./kymora/bench";
import { referenceFor } from "./kymora/synth";
import type { HeldOutResults, PtbxlLookup } from "./schemas";
import type { AdapterMode, BenchConfig, DigitizeResult, StripSummary } from "./types";

export interface KymoraAdapter {
  /** Which data source actually answers. Reported in every ApiResponse. */
  mode: AdapterMode;
  featuredStripId: string;
  /** Full seeds, including render parameters, for the workspace. */
  listStrips(): StripSeed[];
  /** Seeds without render parameters, with the true reference rate. */
  listSummaries(): StripSummary[];
  getStrip(id: string): StripSeed | undefined;
  /** Full pipeline run (measurement, baseline, ground truth) for a result page. Null for an unknown id. */
  getRun(id: string): StripRun | null;
  /** Flat numbers of one result. Null for an unknown id. */
  getResult(id: string): DigitizeResult | null;
  /** Seed and size of the bench the /how page runs in the browser. */
  getBenchConfig(): BenchConfig;
  /** The same bench, computed on the server. */
  getBench(): BenchSummary;
  /** The committed held-out PTB-XL fold 10 results, or null when this source has none. */
  getHeldOut(): HeldOutResults | null;
  /**
   * The ecg_id to reference lookup for dropped PTB-XL photos, or null when this source has
   * none. Null is the documented fallback: no lookup means no reference, the result still renders.
   */
  getReferenceLookup(): PtbxlLookup | null;
}

function summaryOf(strip: StripSeed): StripSummary {
  return {
    id: strip.id,
    title: strip.title,
    scenario: strip.scenario,
    capture: strip.capture,
    stress: strip.stress,
    referenceBpm: Math.round(referenceFor(strip.params).heartRateBpm * 10) / 10,
    synthetic: true,
  };
}

function resultOf(strip: StripSeed, run: StripRun): DigitizeResult {
  const k = run.kymora;
  return {
    id: strip.id,
    title: strip.title,
    synthetic: true,
    accepted: k.accepted,
    quality: k.quality,
    reasons: k.reasons,
    bpm: k.accepted ? k.heartRateBpm : null,
    meanRrMs: k.accepted ? k.meanRrMs : null,
    rrMs: k.accepted ? k.rrMs : [],
    pxPerMm: k.pxPerMmX,
    skewDeg: k.skewDeg,
    reference: { heartRateBpm: run.reference.heartRateBpm, meanRrMs: run.reference.meanRrMs },
    baselineBpm: run.baseline.heartRateBpm,
  };
}

export const fakeAdapter: KymoraAdapter = {
  mode: "fake",
  featuredStripId: FEATURED_STRIP_ID,
  listStrips: () => seedStrips,
  listSummaries: () => seedStrips.map(summaryOf),
  getStrip: (id) => stripById(id),
  getRun(id) {
    const strip = stripById(id);
    return strip ? runStrip(strip.params) : null;
  },
  getResult(id) {
    const strip = stripById(id);
    return strip ? resultOf(strip, runStrip(strip.params)) : null;
  },
  getBenchConfig: () => ({ seed: BENCH_DEFAULTS.seed, n: BENCH_DEFAULTS.n }),
  getBench() {
    const { seed, n } = BENCH_DEFAULTS;
    return summarize(seed, benchStrips(seed, n).map(evaluateCase));
  },
  getHeldOut: () => null,
  getReferenceLookup: () => null,
};
