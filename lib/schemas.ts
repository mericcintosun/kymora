/**
 * zod schemas for every edge where data enters Kymora from outside the type system:
 * route params, the held-out manifest and reference files written by Python, and the
 * committed results file read by the server. All exported so the tests can use them.
 */
import { z } from "zod";

/** Seeded strip ids look like "sinus-72-tilted": lowercase words and digits joined by single hyphens. */
export const stripIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const rendererSchema = z.enum(["ecg-image-kit", "matplotlib"]);

export const manifestRecordSchema = z.object({
  /** Image path relative to data/ptbxl-fold10/, for example "images/00009.png". */
  file: z.string().min(1),
  ecgId: z.number().int().positive(),
  /** Sampling rate of the reference waveform in mvFile (100 Hz). */
  fs: z.number().positive(),
  /** Seconds from the image's left edge to the first trace sample. */
  traceStartS: z.number().min(0),
  /** Reference R peaks in seconds from the first trace sample, detected on the 500 Hz signal. */
  rPeaksS: z.array(z.number()),
  heartRateBpm: z.number().positive(),
  meanRrMs: z.number().positive(),
  /** Reference waveform path relative to data/ptbxl-fold10/, for example "reference/00009.json". */
  mvFile: z.string().min(1),
});

export const manifestSchema = z.object({
  renderer: rendererSchema,
  seed: z.number().int(),
  config: z.record(z.string(), z.unknown()),
  records: z.array(manifestRecordSchema).min(1),
});

export const referenceFileSchema = z.object({
  fs: z.number().positive(),
  mv: z.array(z.number()).min(1),
});

export const benchRowSchema = z.object({
  method: z.string().min(1),
  n: z.number().int().min(0),
  hrMae: z.number().nullable(),
  rrMae: z.number().nullable(),
  snrDb: z.number().nullable(),
  rejectionRate: z.number().min(0).max(1),
});

export const histogramSchema = z.object({
  edges: z.array(z.number()),
  kymora: z.array(z.number().int().min(0)),
  baseline: z.array(z.number().int().min(0)),
});

export const heldOutResultsSchema = z.object({
  generatedAt: z.string().min(1),
  renderer: rendererSchema,
  seed: z.number().int(),
  n: z.number().int().positive(),
  config: z.record(z.string(), z.unknown()),
  rows: z.array(benchRowSchema).length(3),
  histogram: histogramSchema,
  perRecord: z.array(
    z.object({
      ecgId: z.number().int().positive(),
      referenceBpm: z.number(),
      kymoraBpm: z.number().nullable(),
      baselineBpm: z.number().nullable(),
    })
  ),
});

/**
 * The compact PTB-XL reference lookup (eval/ptbxl-lookup.json, written by `npm run lookup`
 * from the manifest). Keys are the ecg_id as a plain number string, for example "9".
 */
export const ptbxlLookupSchema = z.object({
  source: z.string().min(1),
  records: z.record(
    z.string().regex(/^[1-9][0-9]{0,4}$/),
    z.object({
      heartRateBpm: z.number().positive(),
      meanRrMs: z.number().positive(),
    })
  ),
});

/**
 * A local result the workspace stored in this tab's sessionStorage (key kymora:<id>).
 * Checks the fields ResultView reads first; the rest of Measurement passes through.
 */
export const storedLocalResultSchema = z.object({
  label: z.string().min(1),
  dataUrl: z.string().nullable(),
  measurement: z
    .object({
      accepted: z.boolean(),
      quality: z.number(),
      reasons: z.array(z.string()),
      trace: z.array(z.tuple([z.number(), z.number()])),
      peaks: z.array(z.tuple([z.number(), z.number()])),
      width: z.number().positive(),
      height: z.number().positive(),
    })
    .passthrough(),
});

export type Renderer = z.infer<typeof rendererSchema>;
export type PtbxlLookup = z.infer<typeof ptbxlLookupSchema>;
export type Manifest = z.infer<typeof manifestSchema>;
export type ManifestRecord = z.infer<typeof manifestRecordSchema>;
export type ReferenceFile = z.infer<typeof referenceFileSchema>;
export type HeldOutResults = z.infer<typeof heldOutResultsSchema>;
