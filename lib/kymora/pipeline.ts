/**
 * Kymora digitization pipeline.
 *
 * Pure TypeScript with no DOM access, so the exact same functions run in the browser
 * (on canvas ImageData) and in Node (npm run eval). Every stage is a separate,
 * named function so each one can be explained and tested on its own:
 *
 *   splitChannels      RGBA -> luminance + "redness" (r - (g + b) / 2)
 *   buildMasks         redness above the paper level = grid, dark and not red = ink
 *   estimateSkew       projection profile of the grid mask over candidate angles
 *   rotateChannel      bilinear deskew of both channels
 *   gridPeriod         autocorrelation of the grid profile -> pixels per millimetre
 *   extractTrace       ink centroid in every column (grid already masked out)
 *   traceToSignal      pixels -> millivolts and seconds at 25 mm/s, 10 mm/mV
 *   detectRPeaks       Pan-Tompkins style QRS detector (band-pass, derivative,
 *                      squaring, moving-window integration, adaptive thresholds)
 *   digitize           runs the chain and applies the quality gate
 *   baselineDigitize   comparison method: fixed 300 DPI, darkest pixel, no gate
 */

export interface Raster {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export const PAPER_SPEED_MM_PER_S = 25;
export const GAIN_MM_PER_MV = 10;

/** Every tunable number of the pipeline lives here, so the eval can print it. */
export const CONFIG = {
  maxSkewDeg: 8,
  skewStepDeg: 0.25,
  skewFineStepDeg: 0.02,
  minPxPerMm: 3,
  maxPxPerMm: 40,
  gridRedMargin: 6,
  inkLumRatio: 0.6,
  inkRedMargin: 25,
  minColumnMass: 15,
  fs: 250,
  qualityThreshold: 0.6,
  minDurationS: 4,
  minHeartRate: 25,
  maxHeartRate: 220,
} as const;

export interface Signal {
  fs: number;
  /** Time of the first sample, seconds from the left edge of the deskewed strip. */
  t0: number;
  mv: number[];
}

export interface Measurement {
  accepted: boolean;
  quality: number;
  reasons: string[];
  pxPerMmX: number | null;
  pxPerMmY: number | null;
  skewDeg: number;
  gridScore: number;
  continuity: number;
  coverage: number;
  heartRateBpm: number | null;
  meanRrMs: number | null;
  rrMs: number[];
  rPeaksMs: number[];
  signal: Signal;
  /** Digitized trace in the coordinates of the ORIGINAL (tilted) image, decimated. */
  trace: Array<[number, number]>;
  /** R peaks in the coordinates of the original image. */
  peaks: Array<[number, number]>;
  width: number;
  height: number;
  runtimeMs: number;
}

export interface BaselineMeasurement {
  heartRateBpm: number | null;
  meanRrMs: number | null;
  rrMs: number[];
  rPeaksMs: number[];
  signal: Signal;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
const round = (v: number, d: number) => {
  const f = 10 ** d;
  return Math.round(v * f) / f;
};

/* 1. Channels --------------------------------------------------------------- */

export function splitChannels(img: Raster): { lum: Float32Array; red: Float32Array } {
  const n = img.width * img.height;
  const lum = new Float32Array(n);
  const red = new Float32Array(n);
  const d = img.data;
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const r = d[j];
    const g = d[j + 1];
    const b = d[j + 2];
    lum[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    red[i] = r - 0.5 * (g + b);
  }
  return { lum, red };
}

/** Approximate percentile on a strided sample (about 20k values). */
export function percentile(a: ArrayLike<number>, q: number): number {
  const stride = Math.max(1, Math.floor(a.length / 20000));
  const s: number[] = [];
  for (let i = 0; i < a.length; i += stride) s.push(a[i]);
  if (s.length === 0) return 0;
  s.sort((x, y) => x - y);
  return s[clamp(Math.round(q * (s.length - 1)), 0, s.length - 1)];
}

/* 2. Masks ------------------------------------------------------------------ */

export function buildMasks(lum: Float32Array, red: Float32Array, paperLum: number, paperRed: number) {
  const n = lum.length;
  const grid = new Float32Array(n);
  const ink = new Float32Array(n);
  const inkCut = paperLum * CONFIG.inkLumRatio;
  for (let i = 0; i < n; i++) {
    const l = lum[i];
    const rr = red[i] - paperRed;
    // Grid: pinker than the paper and not dark enough to be ink.
    if (l > paperLum * 0.45) grid[i] = Math.max(0, rr - CONFIG.gridRedMargin);
    // Ink: dark and not pink. Weight grows with darkness.
    if (l < inkCut && rr < CONFIG.inkRedMargin) ink[i] = inkCut - l;
  }
  return { grid, ink };
}

/* 3. Skew ------------------------------------------------------------------- */

/**
 * Projection-profile skew search. For each candidate angle the grid mask is
 * sheared so that lines with that slope fall into the same row bin; the angle
 * whose profile has the most energy (sharpest peaks) is the tilt of the paper.
 * Returns degrees; a positive angle means lines go down to the right.
 */
export function estimateSkew(grid: Float32Array, w: number, h: number): number {
  const xStep = Math.max(1, Math.round(w / 900));
  const xs: number[] = [];
  const ys: number[] = [];
  const vs: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x += xStep) {
      const v = grid[y * w + x];
      if (v > 0) {
        xs.push(x);
        ys.push(y);
        vs.push(v);
      }
    }
  }
  if (xs.length < 50) return 0;
  // One degree of headroom: the fine pass may look slightly past the coarse range.
  const maxTan = Math.tan(((CONFIG.maxSkewDeg + 1) * Math.PI) / 180);
  const offset = Math.ceil(w * maxTan) + 1;
  const bins = new Float64Array(h + 2 * offset + 2);
  const energyAt = (deg: number) => {
    const t = Math.tan((deg * Math.PI) / 180);
    bins.fill(0);
    for (let k = 0; k < xs.length; k++) bins[Math.round(ys[k] - xs[k] * t) + offset] += vs[k];
    let e = 0;
    for (let i = 0; i < bins.length; i++) e += bins[i] * bins[i];
    return e;
  };
  /** Best angle of a scan, refined by a parabola through it and its two neighbours. */
  const scan = (from: number, to: number, step: number) => {
    const angles: number[] = [];
    const energy: number[] = [];
    for (let deg = from; deg <= to + 1e-9; deg += step) {
      angles.push(deg);
      energy.push(energyAt(deg));
    }
    let best = 0;
    for (let i = 1; i < energy.length; i++) if (energy[i] > energy[best]) best = i;
    let deg = angles[best];
    if (best > 0 && best < energy.length - 1) {
      const a = energy[best - 1];
      const b = energy[best];
      const c = energy[best + 1];
      const den = a - 2 * b + c;
      if (den !== 0) deg += clamp(0.5 * ((a - c) / den), -0.5, 0.5) * step;
    }
    return deg;
  };
  // Coarse pass over the whole range. The energy peak is a cusp, not a parabola, so the
  // coarse refinement can miss by about 0.1°, which across a 2000 px strip smears the
  // 1 mm horizontal lines by several pixels. A fine pass around the coarse best fixes that.
  const coarse = scan(-CONFIG.maxSkewDeg, CONFIG.maxSkewDeg, CONFIG.skewStepDeg);
  const span = CONFIG.skewStepDeg + CONFIG.skewFineStepDeg;
  return scan(coarse - span, coarse + span, CONFIG.skewFineStepDeg);
}

/* 4. Rotation --------------------------------------------------------------- */

/**
 * Resample a channel so that output pixel q reads the source at c + R(angle)(q - c).
 * With angle = the estimated skew this removes the tilt (deskew).
 */
export function rotateChannel(src: Float32Array, w: number, h: number, angleRad: number, fill: number): Float32Array {
  if (Math.abs(angleRad) < 1e-6) return Float32Array.from(src);
  const out = new Float32Array(w * h);
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  for (let y = 0; y < h; y++) {
    const dv = y - cy;
    for (let x = 0; x < w; x++) {
      const du = x - cx;
      const sx = cx + du * cos - dv * sin;
      const sy = cy + du * sin + dv * cos;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 >= w - 1 || y0 >= h - 1) {
        out[y * w + x] = fill;
        continue;
      }
      const fx = sx - x0;
      const fy = sy - y0;
      const i = y0 * w + x0;
      out[y * w + x] = (src[i] * (1 - fx) + src[i + 1] * fx) * (1 - fy) + (src[i + w] * (1 - fx) + src[i + w + 1] * fx) * fy;
    }
  }
  return out;
}

/** Map a point of the deskewed frame back into the original photo. */
function toObserved(x: number, y: number, w: number, h: number, angleRad: number): [number, number] {
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const du = x - cx;
  const dv = y - cy;
  return [round(cx + du * Math.cos(angleRad) - dv * Math.sin(angleRad), 1), round(cy + du * Math.sin(angleRad) + dv * Math.cos(angleRad), 1)];
}

/* 5. Grid period ------------------------------------------------------------ */

export function autocorrelation(p: Float64Array, maxLag: number): Float64Array {
  const n = p.length;
  let mean = 0;
  for (let i = 0; i < n; i++) mean += p[i];
  mean /= n;
  const c = new Float64Array(n);
  let denom = 0;
  for (let i = 0; i < n; i++) {
    c[i] = p[i] - mean;
    denom += c[i] * c[i];
  }
  const r = new Float64Array(maxLag + 1);
  if (denom === 0) return r;
  for (let L = 0; L <= maxLag; L++) {
    let s = 0;
    for (let i = 0; i + L < n; i++) s += c[i] * c[i + L];
    r[L] = s / (n - L) / (denom / n);
  }
  return r;
}

function refinePeak(r: Float64Array, L: number): number {
  if (L <= 0 || L >= r.length - 1) return L;
  const a = r[L - 1];
  const b = r[L];
  const c = r[L + 1];
  const den = a - 2 * b + c;
  return den === 0 ? L : L + (0.5 * (a - c)) / den;
}

function localPeaks(r: Float64Array, minLag: number): number[] {
  const peaks: number[] = [];
  let runMin = Infinity;
  for (let L = Math.max(1, minLag - 1); L < r.length - 1; L++) {
    runMin = Math.min(runMin, r[L]);
    if (L >= minLag && r[L] > r[L - 1] && r[L] >= r[L + 1] && r[L] - runMin > 0.04) {
      peaks.push(L);
      runMin = r[L];
    }
  }
  return peaks;
}

/**
 * Grid period from the autocorrelation of a projection profile. The first clear
 * peak is either the 1 mm line spacing or, when the faint 1 mm lines hide under
 * strong 5 mm lines, the 5 mm box spacing. A 5 mm repeat is recognised by its
 * structure rather than by height: the 1 mm lines leave a ladder of small peaks
 * at 1/5, 2/5, 3/5 and 4/5 of it. After a light blur those peaks rise only about
 * 0.08 above a floor that the 5 mm pulses push below zero, so any absolute height
 * or sign test misses them and the strip is read five times too large (8 px/mm
 * reported as 40). The 5 mm repeat, when visible, refines the
 * estimate (five times the lag, five times the precision).
 *
 * strength is the height of the first clear peak, the grid's clearest repeat. It
 * is the same value whichever of the two spacings that peak turns out to be, so a
 * correctly calibrated strip is not scored lower than a mis-calibrated one.
 */
export function gridPeriod(profile: Float64Array): { pxPerMm: number; strength: number } | null {
  const maxLag = Math.min(Math.floor(profile.length / 3), Math.ceil(5 * CONFIG.maxPxPerMm) + 2);
  if (maxLag < 8) return null;
  const r = autocorrelation(profile, maxLag);
  const peaks = localPeaks(r, Math.floor(CONFIG.minPxPerMm));
  const first = peaks.find((L) => r[L] > 0.12);
  if (first === undefined) return null;
  let minor = first;
  const fifth = first / 5;
  if (fifth >= CONFIG.minPxPerMm) {
    const tol = Math.max(1, fifth * 0.1);
    // For k = 1..4, the prominent peak (localPeaks already requires a clear rise) nearest k/5 of `first`.
    // No sign test: when strong 5 mm pulses dominate the mean-subtracted profile, every lag
    // outside their overlap sits on a negative floor (about -d/(1-d) for duty cycle d), so the
    // 1 mm rungs are clear local peaks that are still below zero.
    const ladder = [1, 2, 3, 4].map((k) => {
      const near = peaks.filter((L) => L < first && Math.abs(L - k * fifth) <= tol);
      return near.length ? near.reduce((a, b) => (Math.abs(b - k * fifth) < Math.abs(a - k * fifth) ? b : a)) : -1;
    });
    const rungs = ladder.filter((L) => L > 0).length;
    // Three of the four rungs, including the 1 mm one itself, mark `first` as the 5 mm repeat.
    if (ladder[0] > 0 && rungs >= 3) minor = ladder[0];
  }
  let pxPerMm = refinePeak(r, minor);
  const majorLag = Math.round(5 * pxPerMm);
  let best = -1;
  for (let L = majorLag - 2; L <= majorLag + 2; L++) {
    if (L > 0 && L < r.length - 1 && r[L] >= r[L - 1] && r[L] >= r[L + 1] && (best < 0 || r[L] > r[best])) best = L;
  }
  if (best > 0 && r[best] > r[minor] * 0.8) pxPerMm = refinePeak(r, best) / 5;
  if (pxPerMm < CONFIG.minPxPerMm || pxPerMm > CONFIG.maxPxPerMm) return null;
  return { pxPerMm, strength: r[first] };
}

/* 6. Trace ------------------------------------------------------------------ */

/** Ink centroid (row) of every column; NaN where the column holds no ink. */
export function extractTrace(ink: Float32Array, w: number, h: number): Float64Array {
  const ys = new Float64Array(w);
  for (let x = 0; x < w; x++) {
    let m = 0;
    let s = 0;
    for (let y = 0; y < h; y++) {
      const v = ink[y * w + x];
      if (v > 0) {
        m += v;
        s += v * y;
      }
    }
    ys[x] = m > CONFIG.minColumnMass ? s / m : NaN;
  }
  return ys;
}

/** Darkest pixel per column: the baseline's trace extractor. */
function darkestPixelTrace(lum: Float32Array, w: number, h: number): Float64Array {
  const ys = new Float64Array(w);
  for (let x = 0; x < w; x++) {
    let best = 0;
    let bestV = Infinity;
    for (let y = 0; y < h; y++) {
      const v = lum[y * w + x];
      if (v < bestV) {
        bestV = v;
        best = y;
      }
    }
    ys[x] = best;
  }
  return ys;
}

/* 7. Pixels -> mV and seconds ----------------------------------------------- */

export interface TraceSignal {
  signal: Signal;
  filled: Float64Array;
  first: number;
  last: number;
  continuity: number;
  coverage: number;
  baselineRow: number;
}

export function traceToSignal(ys: Float64Array, pxX: number, pxY: number, fs: number): TraceSignal | null {
  const w = ys.length;
  let first = -1;
  let last = -1;
  let valid = 0;
  for (let x = 0; x < w; x++) {
    if (!Number.isNaN(ys[x])) {
      if (first < 0) first = x;
      last = x;
      valid++;
    }
  }
  if (first < 0 || last - first < 10) return null;
  const filled = Float64Array.from(ys);
  // Linear interpolation across gaps inside the trace.
  let prev = first;
  for (let x = first + 1; x <= last; x++) {
    if (!Number.isNaN(ys[x])) {
      if (x - prev > 1) {
        for (let g = prev + 1; g < x; g++) filled[g] = ys[prev] + ((ys[x] - ys[prev]) * (g - prev)) / (x - prev);
      }
      prev = x;
    }
  }
  const sorted: number[] = [];
  for (let x = first; x <= last; x++) if (!Number.isNaN(ys[x])) sorted.push(ys[x]);
  sorted.sort((a, b) => a - b);
  const baselineRow = sorted[Math.floor(sorted.length / 2)];
  const colToS = 1 / (PAPER_SPEED_MM_PER_S * pxX);
  const t0 = (first + 0.5) * colToS;
  const t1 = (last + 0.5) * colToS;
  const n = Math.floor((t1 - t0) * fs) + 1;
  const mv: number[] = new Array(n);
  for (let k = 0; k < n; k++) {
    const col = (t0 + k / fs) / colToS - 0.5;
    const c0 = clamp(Math.floor(col), first, last);
    const c1 = Math.min(last, c0 + 1);
    const f = clamp(col - c0, 0, 1);
    const y = filled[c0] * (1 - f) + filled[c1] * f;
    mv[k] = round((baselineRow - y) / (GAIN_MM_PER_MV * pxY), 4);
  }
  return {
    signal: { fs, t0, mv },
    filled,
    first,
    last,
    continuity: valid / (last - first + 1),
    coverage: (last - first + 1) / w,
    baselineRow,
  };
}

/* 8. R peaks (Pan-Tompkins style) ------------------------------------------- */

function movingAverage(x: Float64Array, win: number): Float64Array {
  const n = x.length;
  const half = Math.floor(win / 2);
  const pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + x[i];
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - half);
    const b = Math.min(n, i + half + 1);
    out[i] = (pre[b] - pre[a]) / (b - a);
  }
  return out;
}

const odd = (v: number) => (Math.round(v) % 2 === 0 ? Math.round(v) + 1 : Math.round(v));

/**
 * QRS detector after Pan and Tompkins (1985), adapted to any sampling rate:
 * moving-average band-pass, five-point derivative, squaring, 150 ms moving-window
 * integration, adaptive signal/noise peak levels, 200 ms refractory period,
 * T-wave rejection inside 360 ms and search-back after 166% of the running RR.
 * Returns sample indices of R peaks located on the band-limited trace.
 */
export function detectRPeaks(mv: number[], fs: number): number[] {
  const n = mv.length;
  if (n < fs) return [];
  const x = Float64Array.from(mv);
  const lp = movingAverage(x, odd(0.025 * fs));
  const base = movingAverage(lp, odd(0.2 * fs));
  const bp = new Float64Array(n);
  for (let i = 0; i < n; i++) bp[i] = lp[i] - base[i];
  const der = new Float64Array(n);
  for (let i = 2; i < n - 2; i++) der[i] = ((2 * bp[i + 2] + bp[i + 1] - bp[i - 1] - 2 * bp[i - 2]) * fs) / 8;
  const sq = new Float64Array(n);
  for (let i = 0; i < n; i++) sq[i] = der[i] * der[i];
  const mwi = movingAverage(sq, odd(0.15 * fs));

  const refractory = Math.round(0.2 * fs);
  const cands: number[] = [];
  for (let i = 1; i < n - 1; i++) {
    if (mwi[i] > mwi[i - 1] && mwi[i] >= mwi[i + 1]) {
      const last = cands[cands.length - 1];
      if (last !== undefined && i - last < refractory) {
        if (mwi[i] > mwi[last]) cands[cands.length - 1] = i;
      } else cands.push(i);
    }
  }
  if (cands.length === 0) return [];

  const learn = Math.min(n, 2 * fs);
  let maxLearn = 0;
  let meanLearn = 0;
  for (let i = 0; i < learn; i++) {
    maxLearn = Math.max(maxLearn, mwi[i]);
    meanLearn += mwi[i];
  }
  meanLearn /= learn;
  let spki = 0.6 * maxLearn;
  let npki = meanLearn;

  const slopeAt = (i: number) => {
    let m = 0;
    for (let k = Math.max(0, i - Math.round(0.075 * fs)); k <= Math.min(n - 1, i + Math.round(0.075 * fs)); k++) m = Math.max(m, Math.abs(der[k]));
    return m;
  };

  const beats: number[] = [];
  let rrAvg = 0;
  for (const c of cands) {
    const v = mwi[c];
    const thr = npki + 0.25 * (spki - npki);
    if (v <= thr) {
      npki = 0.125 * v + 0.875 * npki;
      continue;
    }
    const prev = beats[beats.length - 1];
    if (prev !== undefined && c - prev < 0.36 * fs && slopeAt(c) < 0.5 * slopeAt(prev)) {
      npki = 0.125 * v + 0.875 * npki; // T wave, not a QRS
      continue;
    }
    if (prev !== undefined && rrAvg > 0 && c - prev > 1.66 * rrAvg) {
      let missed = -1;
      for (const m of cands) {
        if (m > prev + refractory && m < c - refractory && mwi[m] > 0.5 * thr && (missed < 0 || mwi[m] > mwi[missed])) missed = m;
      }
      if (missed >= 0) {
        beats.push(missed);
        spki = 0.25 * mwi[missed] + 0.75 * spki;
      }
    }
    beats.push(c);
    spki = 0.125 * v + 0.875 * spki;
    if (beats.length >= 2) {
      const recent = beats.slice(-9);
      rrAvg = (recent[recent.length - 1] - recent[0]) / (recent.length - 1);
    }
  }

  // Locate each R on the low-passed trace and merge peaks closer than 250 ms.
  const win = Math.round(0.1 * fs);
  const out: number[] = [];
  for (const b of beats) {
    let best = b;
    for (let k = Math.max(0, b - win); k <= Math.min(n - 1, b + win); k++) if (lp[k] > lp[best]) best = k;
    const last = out[out.length - 1];
    if (last !== undefined && best - last < 0.25 * fs) {
      if (lp[best] > lp[last]) out[out.length - 1] = best;
    } else out.push(best);
  }
  return out;
}

function rhythm(peaks: number[], signal: Signal) {
  const rPeaksMs = peaks.map((i) => round((signal.t0 + i / signal.fs) * 1000, 1));
  const rrMs: number[] = [];
  for (let i = 1; i < rPeaksMs.length; i++) rrMs.push(round(rPeaksMs[i] - rPeaksMs[i - 1], 1));
  const meanRrMs = rrMs.length ? rrMs.reduce((a, b) => a + b, 0) / rrMs.length : null;
  return {
    rPeaksMs,
    rrMs,
    meanRrMs: meanRrMs === null ? null : round(meanRrMs, 1),
    heartRateBpm: meanRrMs ? round(60000 / meanRrMs, 1) : null,
  };
}

/* 9. The full chain + quality gate ------------------------------------------ */

export function digitize(img: Raster): Measurement {
  const started = now();
  const { width: w, height: h } = img;
  const { lum, red } = splitChannels(img);
  const paperLum = percentile(lum, 0.85);
  const paperRed = percentile(red, 0.5);

  const raw = buildMasks(lum, red, paperLum, paperRed);
  const skewDeg = estimateSkew(raw.grid, w, h);
  const angle = (skewDeg * Math.PI) / 180;
  const lumD = rotateChannel(lum, w, h, angle, paperLum);
  const redD = rotateChannel(red, w, h, angle, paperRed);
  const { grid, ink } = buildMasks(lumD, redD, paperLum, paperRed);

  const col = new Float64Array(w);
  const row = new Float64Array(h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = grid[y * w + x];
      col[x] += v;
      row[y] += v;
    }
  }
  const gx = gridPeriod(col);
  const gy = gridPeriod(row);
  const pxPerMmX = gx?.pxPerMm ?? gy?.pxPerMm ?? null;
  const pxPerMmY = gy?.pxPerMm ?? gx?.pxPerMm ?? null;
  const strengths = [gx?.strength, gy?.strength].filter((s): s is number => s !== undefined);
  const meanStrength = strengths.length ? strengths.reduce((a, b) => a + b, 0) / strengths.length : 0;
  const gridScore = strengths.length ? clamp((meanStrength - 0.12) / 0.3, 0, 1) * (strengths.length === 2 ? 1 : 0.8) : 0;

  const ys = extractTrace(ink, w, h);
  const reasons: string[] = [];
  const empty: Signal = { fs: CONFIG.fs, t0: 0, mv: [] };

  // Display trace in original photo coordinates, independent of calibration.
  const validCols: number[] = [];
  for (let x = 0; x < w; x++) if (!Number.isNaN(ys[x])) validCols.push(x);
  const step = Math.max(1, Math.ceil(validCols.length / 1500));
  const trace: Array<[number, number]> = [];
  for (let i = 0; i < validCols.length; i += step) trace.push(toObserved(validCols[i] + 0.5, ys[validCols[i]], w, h, angle));

  const base = {
    skewDeg: round(skewDeg, 2),
    gridScore: round(gridScore, 2),
    width: w,
    height: h,
    trace,
    pxPerMmX: pxPerMmX === null ? null : round(pxPerMmX, 3),
    pxPerMmY: pxPerMmY === null ? null : round(pxPerMmY, 3),
  };

  if (pxPerMmX === null || pxPerMmY === null) {
    reasons.push("No millimetre grid found. Kymora needs the red or pink ECG grid to calibrate time and voltage.");
    return {
      ...base,
      accepted: false,
      quality: 0,
      reasons,
      continuity: 0,
      coverage: 0,
      heartRateBpm: null,
      meanRrMs: null,
      rrMs: [],
      rPeaksMs: [],
      signal: empty,
      peaks: [],
      runtimeMs: Math.round(now() - started),
    };
  }

  const ts = traceToSignal(ys, pxPerMmX, pxPerMmY, CONFIG.fs);
  if (!ts) {
    reasons.push("No continuous dark trace found between the grid lines.");
    return {
      ...base,
      accepted: false,
      quality: round(0.55 * gridScore, 2),
      reasons,
      continuity: 0,
      coverage: 0,
      heartRateBpm: null,
      meanRrMs: null,
      rrMs: [],
      rPeaksMs: [],
      signal: empty,
      peaks: [],
      runtimeMs: Math.round(now() - started),
    };
  }

  const peakIdx = detectRPeaks(ts.signal.mv, ts.signal.fs);
  const r = rhythm(peakIdx, ts.signal);
  const colToS = 1 / (PAPER_SPEED_MM_PER_S * pxPerMmX);
  const peaks: Array<[number, number]> = r.rPeaksMs.map((ms) => {
    const c = clamp(Math.round(ms / 1000 / colToS - 0.5), ts.first, ts.last);
    return toObserved(c + 0.5, ts.filled[c], w, h, angle);
  });

  const contScore = clamp((ts.continuity - 0.6) / 0.35, 0, 1);
  const quality = round(0.55 * gridScore + 0.45 * contScore, 2);
  const durationS = ts.signal.mv.length / ts.signal.fs;
  let hardFail = false;
  if (gridScore < 0.5) reasons.push(`The 1 mm grid is faint or blurred (grid score ${gridScore.toFixed(2)}).`);
  if (ts.continuity < 0.85) reasons.push(`The trace breaks in ${Math.round((1 - ts.continuity) * 100)}% of its columns.`);
  if (durationS < CONFIG.minDurationS) {
    hardFail = true;
    reasons.push(`Only ${durationS.toFixed(1)} s of trace. A rhythm measurement needs at least ${CONFIG.minDurationS} s.`);
  }
  if (Math.abs(pxPerMmX / pxPerMmY - 1) > 0.1) {
    hardFail = true;
    reasons.push("Grid squares are not square. The photo is probably taken at an angle (perspective).");
  }
  if (peakIdx.length < 3) {
    hardFail = true;
    reasons.push("Fewer than three beats detected.");
  } else if (r.heartRateBpm !== null && (r.heartRateBpm < CONFIG.minHeartRate || r.heartRateBpm > CONFIG.maxHeartRate)) {
    hardFail = true;
    reasons.push(`Computed rate ${Math.round(r.heartRateBpm)} bpm is outside ${CONFIG.minHeartRate} to ${CONFIG.maxHeartRate} bpm, so calibration is suspect.`);
  }
  const accepted = !hardFail && quality >= CONFIG.qualityThreshold;
  if (!accepted && quality < CONFIG.qualityThreshold) reasons.unshift(`Quality ${quality.toFixed(2)} is below the ${CONFIG.qualityThreshold} gate.`);

  return {
    ...base,
    accepted,
    quality,
    reasons,
    continuity: round(ts.continuity, 3),
    coverage: round(ts.coverage, 3),
    heartRateBpm: accepted ? r.heartRateBpm : null,
    meanRrMs: accepted ? r.meanRrMs : null,
    rrMs: accepted ? r.rrMs : [],
    rPeaksMs: accepted ? r.rPeaksMs : [],
    signal: ts.signal,
    peaks: accepted ? peaks : [],
    runtimeMs: Math.round(now() - started),
  };
}

/* 10. Baseline -------------------------------------------------------------- */

/** Comparison method: assumes a 300 DPI scan, no grid, no deskew, darkest pixel, no gate. */
export const BASELINE_PX_PER_MM = 300 / 25.4;

export function baselineDigitize(img: Raster): BaselineMeasurement {
  const { lum } = splitChannels(img);
  const ys = darkestPixelTrace(lum, img.width, img.height);
  const ts = traceToSignal(ys, BASELINE_PX_PER_MM, BASELINE_PX_PER_MM, CONFIG.fs);
  if (!ts) return { heartRateBpm: null, meanRrMs: null, rrMs: [], rPeaksMs: [], signal: { fs: CONFIG.fs, t0: 0, mv: [] } };
  const r = rhythm(detectRPeaks(ts.signal.mv, ts.signal.fs), ts.signal);
  return { ...r, signal: ts.signal };
}

/* 11. Export ---------------------------------------------------------------- */

export function toCsv(m: Pick<Measurement, "signal" | "rPeaksMs" | "heartRateBpm" | "pxPerMmX" | "pxPerMmY" | "skewDeg" | "quality">, label: string): string {
  const lines = [
    `# Kymora digitized lead II rhythm strip: ${label}`,
    `# paper speed ${PAPER_SPEED_MM_PER_S} mm/s, gain ${GAIN_MM_PER_MV} mm/mV, fs ${m.signal.fs} Hz`,
    `# grid ${m.pxPerMmX ?? "n/a"} px/mm (x), ${m.pxPerMmY ?? "n/a"} px/mm (y), tilt ${m.skewDeg} deg, quality ${m.quality}`,
    `# heart rate ${m.heartRateBpm ?? "not reported"} bpm. Research use only, not a diagnostic device.`,
    "time_ms,lead_ii_mv,r_peak",
  ];
  const peakSamples = new Set(m.rPeaksMs.map((ms) => Math.round((ms / 1000 - m.signal.t0) * m.signal.fs)));
  m.signal.mv.forEach((v, i) => {
    const t = (m.signal.t0 + i / m.signal.fs) * 1000;
    lines.push(`${t.toFixed(1)},${v.toFixed(4)},${peakSamples.has(i) ? 1 : 0}`);
  });
  return lines.join("\n");
}
