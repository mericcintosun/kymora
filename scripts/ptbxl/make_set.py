#!/usr/bin/env python3
"""Build the held-out PTB-XL fold 10 set for `npm run eval -- --set ptbxl`.

Reads a local PTB-XL copy (never downloads it), takes the first 300 records of
strat_fold 10 by ecg_id, and for each one:

  * reads lead II from records500 with wfdb,
  * detects reference R peaks on the 500 Hz signal (wfdb.processing.xqrs_detect,
    refined with correct_peaks), in seconds from the first sample,
  * writes the lead II waveform resampled to 100 Hz (mV) to reference/<ecg_id>.json,
  * renders a paper strip image to images/<ecg_id>.png, then applies the same seeded
    degradations for both renderers (tilt, blur, shadow, JPEG round trip).

Renderers:
  --renderer ecgkit      (default) shells out to ECG-Image-Kit with a fixed seed and
                         crops the lead II rhythm strip. Needs --ecgkit-dir.
  --renderer matplotlib  a small seeded pink-grid renderer, the documented fallback.

The manifest records the renderer, the seed, the full render config and, per
record, traceStartS: the time from the image's left edge to the first trace sample.

Usage:
  pip install -r scripts/ptbxl/requirements.txt
  python scripts/ptbxl/make_set.py --ptbxl-root /data/ptb-xl/1.0.3 --renderer ecgkit --ecgkit-dir /src/ecg-image-kit
  python scripts/ptbxl/make_set.py --ptbxl-root /data/ptb-xl/1.0.3 --renderer matplotlib
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
import wfdb
from wfdb import processing
from PIL import Image, ImageFilter

REPO = Path(__file__).resolve().parents[2]
PT_PER_MM = 72 / 25.4


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--ptbxl-root", required=True, type=Path, help="local PTB-XL folder containing ptbxl_database.csv and records500/")
    p.add_argument("--renderer", choices=["ecgkit", "matplotlib"], default="ecgkit")
    p.add_argument("--ecgkit-dir", type=Path, default=None, help="local clone of ECG-Image-Kit (needed for --renderer ecgkit)")
    p.add_argument("--out", type=Path, default=REPO / "data" / "ptbxl-fold10")
    p.add_argument("--config", type=Path, default=REPO / "scripts" / "ptbxl" / "render-config.json")
    p.add_argument("--n", type=int, default=300)
    p.add_argument("--seed", type=int, default=42)
    return p.parse_args()


def fold10(root: Path, n: int) -> list[tuple[int, str]]:
    rows: list[tuple[int, str]] = []
    with open(root / "ptbxl_database.csv", newline="") as f:
        for r in csv.DictReader(f):
            if int(float(r["strat_fold"])) == 10:
                rows.append((int(float(r["ecg_id"])), r["filename_hr"]))
    rows.sort()
    return rows[:n]


def lead_ii(root: Path, filename_hr: str) -> tuple[np.ndarray | None, float]:
    rec = wfdb.rdrecord(str(root / filename_hr))
    names = [s.upper() for s in rec.sig_name]
    if "II" not in names:
        return None, float(rec.fs)
    sig = np.nan_to_num(rec.p_signal[:, names.index("II")].astype(float))
    return sig, float(rec.fs)


def r_peaks_s(sig: np.ndarray, fs: float) -> np.ndarray:
    idx = processing.xqrs_detect(sig=sig, fs=fs, verbose=False)
    if len(idx) == 0:
        return np.array([])
    idx = processing.correct_peaks(sig, idx, search_radius=int(0.05 * fs), smooth_window_size=int(0.15 * fs), peak_dir="compare")
    idx = np.unique(idx[(idx >= 0) & (idx < len(sig))])
    return idx / fs


def rgb(c: list[int]) -> tuple[float, float, float]:
    return (c[0] / 255, c[1] / 255, c[2] / 255)


def render_matplotlib(mv: np.ndarray, fs: float, px_per_mm: float, cfg: dict) -> Image.Image:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    m = cfg["matplotlib"]
    speed = cfg["paperSpeedMmPerS"]
    dur = len(mv) / fs
    w_mm = (m["traceStartS"] + dur + m["rightMarginS"]) * speed
    h_mm = m["heightMm"]
    dpi = px_per_mm * 25.4
    fig = plt.figure(figsize=(w_mm / 25.4, h_mm / 25.4), dpi=dpi, facecolor=rgb(cfg["paperRgb"]))
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, w_mm)
    ax.set_ylim(h_mm, 0)
    ax.axis("off")
    for k in range(int(w_mm) + 1):
        major = k % 5 == 0
        ax.axvline(k, color=rgb(cfg["majorRgb" if major else "minorRgb"]), lw=(m["majorLineMm"] if major else m["minorLineMm"]) * PT_PER_MM, zorder=1 + major)
    for k in range(int(h_mm) + 1):
        major = k % 5 == 0
        ax.axhline(k, color=rgb(cfg["majorRgb" if major else "minorRgb"]), lw=(m["majorLineMm"] if major else m["minorLineMm"]) * PT_PER_MM, zorder=1 + major)
    t = m["traceStartS"] + np.arange(len(mv)) / fs
    y = m["baselineMm"] - (mv - np.median(mv)) * cfg["gainMmPerMv"]
    ax.plot(t * speed, np.clip(y, 0.5, h_mm - 0.5), color=rgb(cfg["inkRgb"]), lw=m["inkLineMm"] * PT_PER_MM, zorder=3, solid_joinstyle="round")
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=dpi, facecolor=fig.get_facecolor())
    plt.close(fig)
    buf.seek(0)
    return Image.open(buf).convert("RGB")


def render_ecgkit(root: Path, filename_hr: str, seed: int, cfg: dict, ecgkit_dir: Path, work: Path) -> Image.Image:
    """UNVERIFIED: flags follow the ECG-Image-Kit README conventions and were not run."""
    e = cfg["ecgkit"]
    script = ecgkit_dir / e["script"]
    src = root / filename_hr
    out = work / src.name
    out.mkdir(parents=True, exist_ok=True)
    cmd = [sys.executable, str(script), "-i", f"{src}.dat", "-hea", f"{src}.hea", "-o", str(out), "-se", str(seed), *e["args"]]
    subprocess.run(cmd, check=True, cwd=script.parent, stdout=subprocess.DEVNULL)
    pngs = sorted(out.glob("*.png"))
    if not pngs:
        raise RuntimeError(f"ECG-Image-Kit wrote no PNG for {src.name}")
    img = Image.open(pngs[0]).convert("RGB")
    left, top, right, bottom = e["rhythmStripCrop"]
    w, h = img.size
    return img.crop((int(left * w), int(top * h), int(right * w), int(bottom * h)))


def degrade(img: Image.Image, rng: np.random.Generator, cfg: dict) -> tuple[Image.Image, dict]:
    d = cfg["degrade"]
    tilt = float(rng.uniform(*d["tiltDeg"]))
    blur = float(rng.uniform(*d["blurPx"]))
    shadow = float(rng.uniform(*d["shadow"]))
    quality = int(rng.integers(d["jpegQuality"][0], d["jpegQuality"][1] + 1))
    if blur > 0:
        img = img.filter(ImageFilter.GaussianBlur(blur))
    arr = np.asarray(img).astype(np.float32)
    h, w = arr.shape[:2]
    u = np.linspace(0, 1, w)[None, :, None]
    v = np.linspace(0, 1, h)[:, None, None]
    shade = 1 - shadow * 0.5 * np.clip((u - 0.35) / 0.65, 0, 1) * (0.8 + 0.2 * v)
    img = Image.fromarray(np.clip(arr * shade, 0, 255).astype(np.uint8))
    img = img.rotate(tilt, resample=Image.Resampling.BICUBIC, expand=False, fillcolor=tuple(cfg["paperRgb"]))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=quality)
    buf.seek(0)
    params = {"tiltDeg": round(tilt, 2), "blurPx": round(blur, 2), "shadow": round(shadow, 3), "jpegQuality": quality}
    return Image.open(buf).convert("RGB"), params


def main() -> int:
    args = parse_args()
    cfg = json.loads(args.config.read_text())
    if args.renderer == "ecgkit" and args.ecgkit_dir is None:
        print("--renderer ecgkit needs --ecgkit-dir (a local ECG-Image-Kit clone); use --renderer matplotlib otherwise.", file=sys.stderr)
        return 1
    out: Path = args.out
    (out / "images").mkdir(parents=True, exist_ok=True)
    (out / "reference").mkdir(parents=True, exist_ok=True)
    ref_fs = cfg["referenceFs"]
    records, skipped = [], []
    work = Path(tempfile.mkdtemp(prefix="kymora-ecgkit-"))
    try:
        for ecg_id, filename_hr in fold10(args.ptbxl_root, args.n):
            sig, fs = lead_ii(args.ptbxl_root, filename_hr)
            if sig is None:
                skipped.append({"ecgId": ecg_id, "reason": "no lead II"})
                continue
            peaks = r_peaks_s(sig, fs)
            if len(peaks) < cfg["minPeaks"]:
                skipped.append({"ecgId": ecg_id, "reason": f"{len(peaks)} R peaks detected"})
                continue
            mean_rr_ms = float(np.mean(np.diff(peaks))) * 1000
            mv, _ = processing.resample_sig(sig, fs, ref_fs)
            rng = np.random.default_rng([args.seed, ecg_id])
            render: dict = {}
            if args.renderer == "matplotlib":
                px = float(rng.uniform(*cfg["matplotlib"]["pxPerMm"]))
                img = render_matplotlib(mv, ref_fs, px, cfg)
                trace_start = cfg["matplotlib"]["traceStartS"]
                render["pxPerMm"] = round(px, 2)
            else:
                img = render_ecgkit(args.ptbxl_root, filename_hr, args.seed, cfg, args.ecgkit_dir, work)
                trace_start = cfg["ecgkit"]["traceStartS"]
            img, degradation = degrade(img, rng, cfg)
            render.update(degradation)
            name = f"{ecg_id:05d}"
            img.save(out / "images" / f"{name}.png")
            (out / "reference" / f"{name}.json").write_text(json.dumps({"fs": ref_fs, "mv": [round(float(x), 4) for x in mv]}))
            records.append(
                {
                    "file": f"images/{name}.png",
                    "ecgId": ecg_id,
                    "fs": ref_fs,
                    "traceStartS": trace_start,
                    "rPeaksS": [round(float(x), 4) for x in peaks],
                    "heartRateBpm": round(60000 / mean_rr_ms, 1),
                    "meanRrMs": round(mean_rr_ms, 1),
                    "mvFile": f"reference/{name}.json",
                    "render": render,
                }
            )
            print(f"  {len(records)} written, {len(skipped)} skipped (ecg_id {ecg_id})")
    finally:
        shutil.rmtree(work, ignore_errors=True)

    manifest = {
        "renderer": "ecg-image-kit" if args.renderer == "ecgkit" else "matplotlib",
        "seed": args.seed,
        "config": cfg,
        "source": {"dataset": "PTB-XL", "fold": 10, "lead": "II", "signalFs": 500, "selection": f"first {args.n} by ecg_id"},
        "skipped": skipped,
        "records": records,
    }
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n")
    print(f"wrote {out / 'manifest.json'}: {len(records)} records, {len(skipped)} skipped, renderer {manifest['renderer']}, seed {args.seed}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
