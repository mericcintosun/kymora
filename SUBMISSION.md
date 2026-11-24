# SUBMISSION: Kymora (Devpost fields, in form order)

Paste each field into the Devpost form. Character counts are approximate and were counted by hand. The two PROOF blocks below are rewritten by `npm run proof` together with README.md, so run it right before pasting.

## Project name

Kymora

## Tagline (elevator pitch, about 134 characters)

Paper ECG strips, measured in your browser: heart rate and RR intervals from a phone photo, no upload, and no number from a bad photo.

## About the project

### The problem, and who has it

Millions of ECGs only exist on paper or as scanned images. A GP at a rural health post photographs a lead II rhythm strip and sends it to a cardiologist, who measures it by eye with a ruler. A researcher with a cabinet of archived printouts cannot run any signal analysis on them. The George B. Moody PhysioNet Challenge 2024 was devoted to digitizing ECG images, so this is a known gap. The open tools we found are Python pipelines, MATLAB code or desktop downloads, and the web tools we found upload the patient image to a server.

### What Kymora does

Kymora reads a phone photo of a printed lead II strip inside the browser tab. It finds the pink grid, corrects the tilt, uses the paper's own 1 mm grid as the ruler (25 mm/s, 10 mm/mV), extracts the trace as a 250 Hz signal in millivolts, detects the R peaks and reports heart rate and RR intervals with a CSV download. When the photo cannot support a measurement, it shows "No reliable measurement", the quality score against the 0.60 gate and the reasons, and no number. Every result has its own URL. The photo never leaves the device: no server route accepts images.

### How we built it

The digitizer is one pure TypeScript module, `lib/kymora/pipeline.ts`, that runs unchanged in the browser and in Node for the evaluation:

1. Grid and ink masks from luminance and a redness value per pixel.
2. Tilt from projecting the grid mask at every angle from -8° to +8° in 0.25° steps.
3. Scale from autocorrelating the deskewed grid profile (1 mm lines, refined by the 5 mm boxes), separately for time and voltage.
4. Trace from the ink centroid of each column, converted to mV and resampled to 250 Hz.
5. Beats from our own TypeScript adaptation of the Pan-Tompkins QRS detector.
6. A quality gate (0.55 × grid score + 0.45 × trace continuity, plus hard checks on beats, grid shape, duration and plausible rate).

There is no machine-learning model in the app. The site is Next.js 15 on Vercel; the landing page and the twelve seeded result pages run the same pipeline at build time.

### Evaluation

Metrics in clinical units: HR MAE (bpm), RR MAE (ms, each detected interval against the reference interval at the nearest true R peak within 150 ms), SNR (dB, the PhysioNet Challenge 2024 digitization metric, best lag within ±60 ms) and the rejection rate. The comparison is a baseline that assumes a 300 DPI scan, takes the darkest pixel per column and has no gate; it is also scored on only the strips Kymora accepted, so rejections do not flatter Kymora.

Layer 1 is a seeded synthetic bench (`lib/kymora/synth.ts`, exact ground truth, tilt, scale, blur, shadow and noise). It runs in the browser on `/how` and with `npm run eval`. Latest proof run:

<!-- PROOF:BEGIN eval-synthetic -->
Command: `npm run eval -- --seed 42 --n 60 --out eval/proof-synthetic.json`

```text
Kymora synthetic bench: seed 42, 60 strips

method                                     n   HR MAE (bpm)  RR MAE (ms)  SNR (dB)  rejected
-----------------------------------------  --  ------------  -----------  --------  --------
Kymora (grid calibration + quality gate)   3   0.13          1.2          13.67     95.0%   
Baseline (300 DPI assumed, darkest pixel)  59  39.44         277.5        -3.20     1.7%    
Baseline on the strips Kymora accepted     3   23.67         130.9        -4.30     0.0%    

config: {"maxSkewDeg":8,"skewStepDeg":0.25,"minPxPerMm":3,"maxPxPerMm":40,"gridRedMargin":6,"inkLumRatio":0.6,"inkRedMargin":25,"minColumnMass":15,"fs":250,"qualityThreshold":0.6,"minDurationS":4,"minHeartRate":25,"maxHeartRate":220}
```
<!-- PROOF:END eval-synthetic -->

Read honestly (this paragraph describes the run committed on 2026-11-24; reread it if `npm run proof` changes the table): Kymora withheld a number on 95% of the strips. Where it did report, its error was far below the baseline's on the same 3 strips, but 3 is a tiny sample, and the gate currently refuses far more strips than it should.

Layer 2 is the held-out clinical set: PTB-XL fold 10 (the test fold its authors recommend), rendered as paper strips from a fixed seed and a committed config, scored by the same code and never used for tuning. Its status in this build:

<!-- PROOF:BEGIN eval-ptbxl -->
Not run in this build: data/ptbxl-fold10 has not been generated (needs Python, wfdb and a local PTB-XL copy).
<!-- PROOF:END eval-ptbxl -->

All demo strips are synthetic, and the site labels them that way. Real phone photos of printed strips are harder than both layers.

### Who benefits, and who could be harmed

Benefits: clinicians far from a cardiologist who get strips as photos and measure them by eye today; researchers with paper ECG archives; indirectly, patients whose old printouts become comparable with new recordings.

Harm: a patient with bradycardia, if a wrong calibration reports 60 bpm for a true 40 and the slow rate is missed. The gate rejects implausible scales for this reason, and the bench reports HR error with its sign. A second risk is strips unlike our test images (grey grids, no grid, 50 mm/s paper speed). Kymora assumes 25 mm/s and 10 mm/mV, so a 50 mm/s strip would read at half its true rate.

### Limitations

- Lead II rhythm strips only; a 12-lead page must be cropped first.
- Grid detection relies on colour, so black and white copies are rejected.
- Tilt is corrected; perspective is only detected and then rejected.
- The synthetic strips are cleaner than real photos, and the held-out PTB-XL table is not generated in this build.
- Heart rate and RR only: no rhythm labels, no QT, no diagnosis.

### With one more month

Perspective correction from the four grid corners. A learned trace extractor compared against the centroid method on the same held-out set. A 12-lead layout parser. A small reader study where clinicians compare Kymora's RR values with their own ruler measurements.

## Built with

next, react, typescript, tailwindcss, gsap, @gsap/react, zod, pngjs, @radix-ui/react-slot, class-variance-authority, lucide-react, tsx, vercel. The held-out set builder is Python (`scripts/ptbxl/requirements.txt`), outside the web app.

## Try it out

- Live app: https://kymora-eight.vercel.app (click "Digitize an example strip")
- Source: https://github.com/mericcintosun/kymora

## AI tools disclosure

The hackathon rules allow AI assistants and generators and ask for a disclosure of which tools did what. Claude Code (Anthropic) drafted the Next.js scaffold, the pipeline functions, the PTB-XL set builder, the eval loader, the tests, the SVG illustrations and the docs; the team reviewed, tested and edited all of it. No AI model runs inside Kymora.

## Attribution

- Pan J, Tompkins WJ. A real-time QRS detection algorithm. IEEE Trans Biomed Eng. 1985;32(3):230-236. Our detector is our own TypeScript adaptation.
- Wagner P, Strodthoff N, et al. PTB-XL, a large publicly available electrocardiography dataset. Scientific Data 7, 154 (2020). PhysioNet.
- Shivashankara KK, et al. ECG-Image-Kit: a synthetic image generation toolbox to facilitate deep learning-based electrocardiogram digitization. Physiological Measurement (2024).
- Goldberger A, et al. PhysioBank, PhysioToolkit, and PhysioNet. Circulation 101(23) (2000).
- The George B. Moody PhysioNet Challenge 2024 for the SNR metric definition.

## Tracks entered

All four categories are automatic: the organizer panel scores every submission, so there is no separate opt-in action.

| Bounty | Prize |
|---|---|
| Grand Prize | A signed PDF certificate of achievement for the highest combined score across the four published judging criteria. No cash value. |
| Excellence in Research & Reproducibility | A signed PDF certificate of achievement for strong evaluation, appropriate comparisons, transparent limitations, and reproducible results. No cash value. |
| Best Presentation | A signed PDF certificate of achievement for the clearest explanation of the project, its working features, and its results. No cash value. |
| Best Logo | A signed PDF certificate of achievement for the strongest project logo, judged on originality, clarity, and relevance to the project. No cash value. |

Opt-in lines carried from DELIVERY.md: Grand Prize, "action: none, the organizer panel scores all submissions". Excellence in Research & Reproducibility, "action: none, the organizer panel scores all submissions". Best Presentation, "action: none, the organizer panel scores all submissions". Best Logo, "action: none, the organizer panel scores all submissions".
