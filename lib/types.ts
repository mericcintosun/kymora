/**
 * Shared types for the data seam (lib/adapter.ts) and the API routes.
 * Existing domain types are re-exported, never duplicated.
 */
import type { StressTest, StripSeed } from "./data";

export type { StressTest, StripSeed } from "./data";
export type { BenchSummary, CaseResult, MethodScore, Row as BenchRow } from "./kymora/bench";
export type { Measurement } from "./kymora/pipeline";
export type { StripParams } from "./kymora/synth";

export type AdapterMode = "fake" | "real";

/** One seeded strip without its render parameters, as listed by /api/strips. */
export interface StripSummary {
  id: StripSeed["id"];
  title: string;
  scenario: string;
  capture: string;
  stress: StressTest;
  /** True heart rate of the strip, from the ground truth (not the nominal rate). */
  referenceBpm: number;
  /** Every strip in fake mode is drawn by lib/kymora/synth.ts. */
  synthetic: boolean;
}

export interface ReferenceValue {
  heartRateBpm: number;
  meanRrMs: number;
}

/** The numbers one digitization produced, flat and JSON friendly. */
export interface DigitizeResult {
  id: string;
  title: string;
  synthetic: boolean;
  accepted: boolean;
  quality: number;
  reasons: string[];
  bpm: number | null;
  meanRrMs: number | null;
  rrMs: number[];
  pxPerMm: number | null;
  skewDeg: number;
  reference: ReferenceValue | null;
  /** What the uncalibrated baseline reports on the same image. */
  baselineBpm: number | null;
}

export interface BenchConfig {
  seed: number;
  n: number;
}

export type ApiResponse<T> = { ok: true; data: T; mode: AdapterMode } | { ok: false; error: string };
