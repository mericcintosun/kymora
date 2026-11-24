# Kymora

Kymora reads a phone photo of a printed lead II ECG rhythm strip in the browser and turns it into a signal in millivolts and milliseconds. It measures heart rate and RR intervals, and when the photo can't support a measurement it refuses to give one.

> Live demo: https://kymora.vercel.app

## The problem

Millions of ECGs only exist on paper or as scanned images. A GP at a rural health post photographs a rhythm strip and sends it over a messaging app, and the cardiologist on the other end measures it by eye with a ruler. A researcher with a cabinet of archived printouts can't run any signal analysis on them.

The George B. Moody PhysioNet Challenge 2024 was devoted entirely to digitizing ECG images, so this is a known gap. The open tools we found come as Python pipelines, MATLAB code or desktop downloads, and the web tools we found upload the image to a server.

## The solution

A pure TypeScript module (`lib/kymora/pipeline.ts`) reads the image from a canvas and runs one function per stage:

1. **Masks.** Each pixel gets a luminance and a redness value (r minus the mean of g and b). Pixels pinker than the paper count as grid. Dark pixels that aren't pink count as ink.
2. **Tilt** (`estimateSkew`). The grid mask is projected at every angle from -8° to +8° in 0.25° steps. The angle that gives the sharpest row profile is the tilt.
3. **Scale** (`gridPeriod`). Autocorrelating the deskewed grid profile finds the 1 mm line spacing, and the 5 mm box spacing refines it. Together they give pixels per millimetre, so the paper acts as its own ruler at 25 mm/s and 10 mm/mV.
4. **Trace** (`extractTrace`, `traceToSignal`). With the grid masked out, the ink centroid of each column becomes one sample. The trace is converted to mV and resampled to 250 Hz.
5. **Beats** (`detectRPeaks`). A Pan-Tompkins style QRS detector (band-pass, derivative, squaring, 150 ms integration, adaptive thresholds, refractory period, T-wave rejection, search-back) finds the R peaks. Heart rate is 60000 divided by the mean RR.
6. **Quality gate.** Quality is 0.55 × grid score + 0.45 × trace continuity. If it falls below 0.6, the app shows the reasons and no number. The same happens with fewer than three beats, a non-square grid, less than 4 s of trace, or a rate outside 25 to 220 bpm.

The photo never leaves the device. There is no server route that accepts images.

**Who it is for:** clinicians who share strips as photos, and researchers digitizing paper archives. **What it is not:** a diagnostic device. It measures rhythm on one lead and nothing else.

## Evaluation

**Metrics, in clinical units**

| Metric | How it is measured |
|---|---|
| HR MAE (bpm) | absolute difference between reported and reference heart rate |
| RR MAE (ms) | each detected RR interval vs the reference interval starting at the nearest true R peak (within 150 ms) |
| SNR (dB) | 10 log10(Σref² / Σ(ref − est)²), means removed, best lag within ±60 ms. This is the PhysioNet Challenge 2024 digitization metric |
| Rejection rate | share of strips where the quality gate withheld a result |

**Comparison.** The baseline assumes a 300 DPI scan (11.81 px/mm), takes the darkest pixel in each column, skips deskewing and has no quality gate. The baseline is also scored on just the strips Kymora accepted, so the comparison isn't flattered by rejections.

**Layer 1, synthetic bench (runs today).** `lib/kymora/synth.ts` draws seeded strips: a Gaussian P-QRS-T beat model on a pink 1 mm / 5 mm grid, plus tilt (±5°), scale (4.5 to 9 px/mm), box blur, shadow and sensor noise. The truth is exact because we generated it. With seed 42, about a quarter of the strips are degraded on purpose. You can run the same bench in the browser on `/how`, or from the command line:

```bash
npm run eval                          # seed 42, 200 strips, writes eval/results.json
npm run eval -- --seed 7 --n 500      # any other seed or size
```

The output table and `eval/results.json` include the full `CONFIG` object (every threshold the pipeline uses). Paste the table here after running it:

```
(results table from npm run eval goes here)
```

**Layer 2, held-out clinical set (in progress).** This uses PTB-XL fold 10, the test fold recommended by the dataset authors. Lead II is read with `wfdb` and rendered as paper rhythm strips by ECG-Image-Kit with a fixed seed and config (tilt, blur, JPEG, shadow). Reference R peaks come from the source signal. The loader stub is `loadPtbxlFold10()` in `scripts/eval.ts` (`npm run eval -- --set ptbxl`). We will report results from real phone photos of printed PTB-XL strips in a separate small table, because those will be worse than the synthetic numbers.

## Who benefits, and who could be harmed

**Benefits:** clinicians far from a cardiologist, who today get strips measured by eye. Researchers with paper ECG archives. Indirectly, patients whose old printouts become comparable with new recordings.

**Harm:** a patient with bradycardia, if a wrong calibration reports 60 bpm for a true 40 and the slow rate gets missed. The gate rejects implausible scales for this reason, and the bench reports HR error with its sign. A second risk is strips that don't look like our test images: grey grids, no grid, or 50 mm/s paper speed. Kymora assumes 25 mm/s and 10 mm/mV, so a 50 mm/s strip would read at half its true rate.

## Limitations

- Lead II rhythm strips only. Crop a 12-lead page before using it.
- Grid detection relies on colour, so black-and-white copies get rejected.
- Tilt is corrected. Perspective is only detected (non-square grid) and then rejected.
- The synthetic strips are cleaner than real photos.
- Kymora reports heart rate and RR only. It gives no rhythm labels, QT, or diagnosis.

## With one more month

Perspective correction from the four corners of the grid. A learned trace extractor for overlapping leads, compared against the current centroid method on the same held-out set. A full 12-lead layout parser. And a small reader study where clinicians compare Kymora's RR values with their own ruler measurements.

## Tech stack

Next.js 15 (App Router), React 19, TypeScript 5 (strict), Tailwind CSS 4, shadcn-style primitives, GSAP 3 with ScrollTrigger and `@gsap/react` (the pinned scene on the landing page), HTML canvas ImageData, tsx for `npm run eval` and `npm run seed`. Deployed as a Vercel site. The held-out set also needs Python with `wfdb` and ECG-Image-Kit, but the web app doesn't.

There are no machine-learning models in the app. Everything is signal processing.

## Quickstart

```bash
npm install
npm run dev        # http://localhost:3000
npm run eval       # reproduce the evaluation table
npm run seed       # list the 12 seeded strips and their reference heart rate
```

No secrets or API keys are needed. One optional variable, `ADAPTER_MODE` (default `fake`, the seeded synthetic strips), selects the data source behind `lib/adapter.ts`; see `.env.example`.

Routes: `/` story, `/digitize` workspace, `/digitize/<strip-id>` shareable result, `/how` method and evaluation.

## Held-out set

```bash
pip install wfdb
# 1. Download PTB-XL from PhysioNet and keep records whose strat_fold == 10.
# 2. Render lead II rhythm strips with ECG-Image-Kit (fixed seed, config committed next to the images).
# 3. Write data/ptbxl-fold10/manifest.json, then implement loadPtbxlFold10() in scripts/eval.ts.
```

## Attribution

- Pan J, Tompkins WJ. A real-time QRS detection algorithm. IEEE Trans Biomed Eng. 1985;32(3):230-236. Our detector is our own TypeScript adaptation of the method.
- Wagner P, Strodthoff N, et al. PTB-XL, a large publicly available electrocardiography dataset. Scientific Data 7, 154 (2020). Distributed by PhysioNet (check the license on the PhysioNet page before redistributing derived images).
- Shivashankara KK, et al. ECG-Image-Kit: a synthetic image generation toolbox to facilitate deep learning-based electrocardiogram digitization. Physiological Measurement (2024).
- Goldberger A, et al. PhysioBank, PhysioToolkit, and PhysioNet. Circulation 101(23) (2000).
- The George B. Moody PhysioNet Challenge 2024 (ECG image digitization and classification) for the SNR metric definition.

## AI use

<!-- Adjust this section to each hackathon's disclosure rules. -->
We used AI coding assistants for scaffolding and boilerplate. Architecture, product decisions, and final code review are our own. Tools: Claude Code (scaffolding the Next.js app, first drafts of the pipeline functions and this README, which we then reviewed, tested and edited).
