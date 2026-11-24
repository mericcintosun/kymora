/**
 * Seeded synthetic paper ECG strips.
 *
 * A parametric beat model (sum of Gaussian P, Q, R, S, T waves) is drawn onto a
 * 25 mm/s, 10 mm/mV pink grid, then degraded the way a phone photo degrades it:
 * blur, tilt, uneven light and sensor noise. Everything is driven by one integer
 * seed, so a strip is identical in every browser and in Node.
 *
 * This is the in-repo stand-in for the held-out PTB-XL fold 10 images rendered
 * with ECG-Image-Kit; the waveform is synthetic, the ground truth is exact.
 */
import { GAIN_MM_PER_MV, PAPER_SPEED_MM_PER_S, rotateChannel, type Raster } from "./pipeline";

export interface StripParams {
  seed: number;
  heartRateBpm: number;
  /** Standard deviation of beat-to-beat RR variation in ms (large = irregular rhythm). */
  rrJitterMs: number;
  pxPerMm: number;
  skewDeg: number;
  blurPx: number;
  /** Sensor noise as a fraction of full scale (0.02 = 2%). */
  noise: number;
  /** Strength of a shadow falling across the right side (0 to 1). */
  shadow: number;
}

export const STRIP = { durationS: 10, heightMm: 40, baselineMm: 25 } as const;

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(rng: () => number): number {
  const u = Math.max(1e-12, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** R-peak times in seconds, including one beat before and after the visible strip. */
export function beatTimes(p: StripParams): number[] {
  const rng = mulberry32(p.seed ^ 0x9e3779b9);
  const mean = 60 / p.heartRateBpm;
  const times: number[] = [];
  let t = -mean + rng() * mean;
  while (t < STRIP.durationS + mean) {
    times.push(t);
    t += Math.max(0.28, mean + (gauss(rng) * p.rrJitterMs) / 1000);
  }
  return times;
}

const WAVES = [
  { at: -0.17, amp: 0.12, width: 0.022 }, // P
  { at: -0.035, amp: -0.1, width: 0.009 }, // Q
  { at: 0, amp: 1.15, width: 0.011 }, // R
  { at: 0.035, amp: -0.28, width: 0.011 }, // S
] as const;

/** Lead II voltage (mV) at time t. */
export function ecgMillivolts(t: number, beats: number[], meanRr: number): number {
  const tAt = 0.24 * Math.sqrt(meanRr) + 0.03;
  let v = 0;
  for (const b of beats) {
    const d = t - b;
    if (d < -0.4 || d > 0.7) continue;
    for (const w of WAVES) v += w.amp * Math.exp(-((d - w.at) ** 2) / (2 * w.width * w.width));
    v += 0.28 * Math.exp(-((d - tAt) ** 2) / (2 * 0.045 * 0.045)); // T
  }
  return v;
}

export interface Reference {
  fs: number;
  mv: number[];
  rPeaksS: number[];
  heartRateBpm: number;
  meanRrMs: number;
}

/** Ground truth: clean signal plus the R peaks that fall on the strip. */
export function referenceFor(p: StripParams, fs = 250): Reference {
  const beats = beatTimes(p);
  const meanRr = 60 / p.heartRateBpm;
  const n = STRIP.durationS * fs;
  const mv: number[] = new Array(n);
  for (let i = 0; i < n; i++) mv[i] = ecgMillivolts(i / fs, beats, meanRr);
  const rPeaksS = beats.filter((b) => b >= 0 && b <= STRIP.durationS);
  const rr: number[] = [];
  for (let i = 1; i < rPeaksS.length; i++) rr.push(rPeaksS[i] - rPeaksS[i - 1]);
  const meanRrMs = (rr.reduce((a, b) => a + b, 0) / Math.max(1, rr.length)) * 1000;
  return { fs, mv, rPeaksS, meanRrMs: Math.round(meanRrMs * 10) / 10, heartRateBpm: Math.round((60000 / meanRrMs) * 10) / 10 };
}

/* Rendering --------------------------------------------------------------- */

const PAPER = [251, 243, 238];
const MINOR = [244, 196, 196];
const MAJOR = [228, 140, 146];
const INK = [38, 30, 34];

function lineCoverage(i: number, s: number, minorHalf: number, majorHalf: number): [number, number] {
  const u = (i + 0.5) / s;
  const k = Math.round(u);
  const d = Math.abs(u - k) * s;
  const major = k % 5 === 0;
  const a = Math.min(1, Math.max(0, (major ? majorHalf : minorHalf) + 0.5 - d));
  return major ? [0, a] : [a, 0];
}

function boxBlur(ch: Float32Array, w: number, h: number, r: number) {
  if (r <= 0) return;
  const tmp = new Float32Array(ch.length);
  const span = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = -r; x <= r; x++) s += ch[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = s / span;
      s += ch[y * w + Math.min(w - 1, x + r + 1)] - ch[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      ch[y * w + x] = s / span;
      s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
}

export function stripSize(p: StripParams): { width: number; height: number } {
  return {
    width: Math.round(STRIP.durationS * PAPER_SPEED_MM_PER_S * p.pxPerMm),
    height: Math.round(STRIP.heightMm * p.pxPerMm),
  };
}

/** Render a seeded strip into an RGBA raster (same layout as canvas ImageData). */
export function renderStrip(p: StripParams): Raster {
  const s = p.pxPerMm;
  const { width: w, height: h } = stripSize(p);
  const n = w * h;
  const ch = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  const minorHalf = Math.max(0.35, 0.06 * s);
  const majorHalf = Math.max(0.6, 0.11 * s);
  const cols = Array.from({ length: w }, (_, x) => lineCoverage(x, s, minorHalf, majorHalf));
  const rows = Array.from({ length: h }, (_, y) => lineCoverage(y, s, minorHalf, majorHalf));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const aMinor = Math.max(cols[x][0], rows[y][0]);
      const aMajor = Math.max(cols[x][1], rows[y][1]);
      const i = y * w + x;
      for (let c = 0; c < 3; c++) {
        const v = PAPER[c] * (1 - aMinor) + MINOR[c] * aMinor;
        ch[c][i] = v * (1 - aMajor) + MAJOR[c] * aMajor;
      }
    }
  }

  // Ink: for each column fill the vertical span the trace sweeps, with soft edges.
  const beats = beatTimes(p);
  const meanRr = 60 / p.heartRateBpm;
  const baselinePx = STRIP.baselineMm * s;
  const half = Math.max(1, 0.17 * s);
  const yAt = (px: number) => baselinePx - ecgMillivolts(px / (PAPER_SPEED_MM_PER_S * s), beats, meanRr) * GAIN_MM_PER_MV * s;
  for (let x = 0; x < w; x++) {
    const ya = yAt(x);
    const yb = yAt(x + 0.5);
    const yc = yAt(x + 1);
    const lo = Math.min(ya, yb, yc) - half;
    const hi = Math.max(ya, yb, yc) + half;
    for (let y = Math.max(0, Math.floor(lo)); y < Math.min(h, Math.ceil(hi)); y++) {
      const cov = Math.min(hi, y + 1) - Math.max(lo, y);
      if (cov <= 0) continue;
      const i = y * w + x;
      for (let c = 0; c < 3; c++) ch[c][i] = ch[c][i] * (1 - cov) + INK[c] * cov;
    }
  }

  const r = Math.round(p.blurPx);
  for (let c = 0; c < 3; c++) {
    boxBlur(ch[c], w, h, r);
    boxBlur(ch[c], w, h, r);
  }

  const angle = (-p.skewDeg * Math.PI) / 180;
  const out = ch.map((c, k) => rotateChannel(c, w, h, angle, PAPER[k] * 0.93));

  const rng = mulberry32(p.seed + 17);
  const data = new Uint8ClampedArray(n * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const u = x / w;
      const shade = 1 - p.shadow * 0.5 * Math.max(0, Math.min(1, (u - 0.35) / 0.65)) * (0.8 + 0.2 * (y / h));
      for (let c = 0; c < 3; c++) data[i * 4 + c] = out[c][i] * shade + gauss(rng) * p.noise * 255;
      data[i * 4 + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}
