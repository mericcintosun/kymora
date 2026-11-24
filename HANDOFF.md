# HANDOFF: Kymora

You are picking up a working Next.js 15 scaffold. Read this file, then `IDENTITY.md`, then `lib/kymora/pipeline.ts`. Start building right away; everything you need is here.

## 1. Context

**Product:** Kymora. It reads a phone photo of a printed lead II ECG rhythm strip in the browser, turns it into a millivolt and millisecond signal, measures heart rate and RR intervals, and refuses to answer when the photo cannot support a measurement.

**Pitch, plain:** You have an old paper ECG and want to send it to a doctor or a research file as data. Open the page and drop a photo of the strip. A few seconds later a green trace sits on top of the printed line, with heart rate and beat-to-beat intervals underneath, and you can download the file. If the photo is too blurred or tilted, the app says "no reliable measurement from this image" instead of guessing. The photo never leaves your browser.

**Hackathon:** AI for Medicine: A Global Student Hackathon on the Future of Care (Devpost, https://ai-for-medicine.devpost.com/). Students only, teams of 1 to 4.
**Deadline:** 4 December 2026, 23:45 EST.
**Target track:** Grand Prize. Also aiming at Excellence in Research & Reproducibility, Best Presentation and Best Logo. All of these are automatic and pay certificates only, no cash.

**Judging, 25% each:** Technical Depth (a real pipeline behind the UI), Rigor & Reproducibility (held-out eval, clinical-unit metric, seeds, configs, code), Clinical Relevance & Honesty (scope and harms stated, accuracy claim matches evidence), Demo Quality (working within the first 60 s, followable without installing anything). Ties go to the stronger held-out evaluation.

**Verified submission requirements:**
- Public repo whose README covers what the project does, how to run it, dependencies, configuration and how to reproduce the evaluation.
- A video of at least 60 s showing the project working end to end. The builder records it.
- Written description with: the problem and who has it, the method, an **Evaluation** section naming the metric and how it is measured, a **"Who benefits, and who could be harmed"** section, limitations, and what you would do with one more month.
- Full attribution for every model, dataset and piece of code you did not write.
- A line in the README naming the AI tools used and what they did.
- The project must work today. Use public datasets or your own recordings only. No video of identifiable people without consent.
- Without an Evaluation section, Technical Depth and Rigor scores are capped at half. Judges may ask what a specific function does.

## 2. Current state

Identity: see IDENTITY.md (direction D9, structure S2, archetype L1, kit K2)

**Routes -> files**
- `/` -> `app/page.tsx`: L1 poster landing. The display headline sits at clamp(3.5rem, 9vw, 8rem) with one CTA under it. Then the scene-1 horizon band and strata, then the full-width pinned live frame, then problem, refusals and the strip list.
- `/digitize` -> `app/digitize/page.tsx` + `components/workspace.tsx`: the workspace. `?strip=<id>` preloads an example, and the landing CTA uses it.
- `/digitize/[id]` -> `app/digitize/[id]/page.tsx`: a shareable result. Seeded ids are computed on the server with the same pipeline and statically generated. `local-*` ids render `components/local-result.tsx` from sessionStorage, because uploads never leave the device.
- `/how` -> `app/how/page.tsx` + `components/bench-panel.tsx`: method, live synthetic bench, who benefits and who is harmed, limits, credits.

**Navigation:** the header (`components/site-header.tsx`) has two links ("Example result", "Method & evaluation") plus the CTA "Digitize a strip". The footer links to Workspace and Method.

**One-mark proof:** the header home link, quoted from `components/site-header.tsx`:
```tsx
<Link href="/" className="flex items-center gap-2.5 font-display text-xl font-semibold text-foreground">
  <BrandMark size={30} />
  Kymora
</Link>
```

**What is real**
- `lib/kymora/pipeline.ts`: the full digitizer (masks, `estimateSkew`, `rotateChannel`, `gridPeriod`, `extractTrace`, `traceToSignal`, `detectRPeaks`, `digitize` with the quality gate, `baselineDigitize`, `toCsv`). Pure TS, runs in the browser and in Node.
- `lib/kymora/synth.ts`: seeded strip renderer (beat model, grid, ink, blur, tilt, shadow, noise) plus exact ground truth (`referenceFor`).
- `lib/kymora/bench.ts`: bench strips, metrics (HR MAE, RR MAE, SNR, rejection rate), summary, histogram, `formatTable`.
- `scripts/eval.ts`: `npm run eval`, deterministic with `--seed`/`--n`, writes `eval/results.json`.
- Workspace: run any of the 12 seeded strips (`lib/data.ts`) or drop your own photo, see the overlay, download CSV, copy the result link.

**What is mocked or stubbed**
- `loadPtbxlFold10()` in `scripts/eval.ts` throws with instructions. This is the held-out PTB-XL fold 10 / ECG-Image-Kit loader and the most important missing piece.
- The demo strips are synthetic (Gaussian beat model), not PTB-XL waveforms. The UI says so.
- The README results table is a placeholder until you run `npm run eval`.

**Interaction kit K2 (gsap)**
- Shipped: signature 1, the pinned scroll scene (`components/strip-scene.tsx`). The landing frame pins while a scrubbed timeline undoes the estimated tilt, fades the grid, draws the digitized trace, pops the R peaks and counts the measured bpm up, all from a real pipeline run on the featured strip at build time. The server HTML shows the finished state, and the animation is skipped under reduced motion.
- To do: signature 2, an intro timeline on first paint. Split the landing h1 into word spans by hand, stagger them, then bring in the scene frame. Animate from the visible state so no-JS HTML stays readable.
- To do: signature 3, a figure tween bound to a control. On `/how` or the result page, switching between Kymora and baseline (a Button pair) tweens the displayed HR MAE and the matching histogram bar heights together, driven by the real bench summary.

**Brand pack:** `public/logo.svg` and `app/icon.svg` (a grid tile with one oxblood PQRST wave and a sun disc), `app/opengraph-image.tsx`, and `public/illustrations/scene-1..3.svg` for the three `<SceneSlot>`s (landing hero band, landing problem section, /how).

**Other files:** `app/globals.css` (IDENTITY tokens, M3 `kymora-scale-in` keyframe with a reduced-motion block), `components/ui/*` (restyled with matte fills, soft 0.375rem radius, no shadows), `components/result-view.tsx` (canvas, SVG overlay, figures, CSV and link actions).

## 3. Mission (in priority order)

1. **Held-out PTB-XL fold 10 set (2.5 h, do this first).** Python: `wfdb` reads PTB-XL records with `strat_fold == 10`. Take 300 records, render lead II rhythm strips with ECG-Image-Kit using a fixed seed and a committed config (tilt, blur, JPEG, shadow), and write `data/ptbxl-fold10/manifest.json` with reference R peaks taken from the signal (or PTB-XL+ annotations, with attribution). Add `pngjs` (plus types) and implement `loadPtbxlFold10()` so it feeds the existing `rrMae`/`snrDb` scoring. Done means `npm run eval -- --set ptbxl` prints a table with Kymora, baseline and baseline-on-accepted rows. If ECG-Image-Kit eats more than an hour, render with a small seeded Python script and say so in the README.
2. **Tune on synthetic only, never on fold 10 (1 h).** Run `npm run eval` and look at the false rejections and the worst HR errors. Adjust `CONFIG`. Write the final table into the README. Done means the README table is real and the CONFIG is printed next to it.
3. **Real photo check, the wow moment (1 h).** Print 3 PTB-XL fold 10 strips, photograph them tilted on a desk, drop them into `/digitize`, and record measured vs reference in a separate small README table. Rehearse: drop the tilted photo, the trace settles on the ink, "72 bpm, RR 833 ms" appears with the reference next to it. Then drop a blurred photo and show "quality 0.31, no measurement". If real photos fail, fix the gate or the masks before polishing anything else.
4. **Eval panel polish (1 h).** Show the PTB-XL table on `/how` as a static import of a committed `eval/ptbxl-results.json` (keep the live synthetic bench too). Build signature 3 here. Done means a judge sees Kymora vs baseline HR MAE, RR MAE, SNR and rejection rate within 10 s of opening `/how`.
5. **Workspace polish (1.5 h).** Signature 2 on the landing page. Show a reference value for uploaded PTB-XL photos when the filename matches an ecg_id in a small committed lookup. Keyboard focus states on the strip buttons. Done means the 0:00 to 0:45 part of the demo script runs without a hitch.
6. **Logo pass (0.5 h).** Check `public/logo.svg` at 28 px and 512 px. If you upload a raster to `public/brand/logo.png`, BrandMark switches to it automatically. Use the same mark on the video cover.
7. **Docs and video (2 h).** README sections are in place: fill in the results, check the PTB-XL and ECG-Image-Kit licenses on their pages, keep the AI use line accurate. Then record the 90 s video: 0 to 15 s drop the tilted strip and show the trace and px/mm; 15 to 45 s peaks, HR/RR vs reference, CSV, then the blurred photo rejected; 45 to 75 s `npm run eval` with seed 42 and the eval panel; 75 to 90 s the limits card, the real desk photo, logo.

## 4. Constraints

- Stack: Next.js 15 App Router, TypeScript strict, Tailwind v4 (no tailwind.config), shadcn primitives in `components/ui/`, deployed on Vercel. No server routes that receive images, no runtime filesystem writes.
- IDENTITY.md is law for every color, font, route, layout and animation decision. Colors come only from the tokens in `app/globals.css`, never a raw hex in a component. Spectral for h1/h2, Rubik for body. Soft 0.375rem radius everywhere. The header stays solid ground with a LINE border. Every GSAP call goes inside `useGSAP` with `gsap.matchMedia()` and a reduced-motion skip.
- Keep the pipeline honest: no number on screen that the code did not compute. Synthetic results are always labelled synthetic. Never tune on fold 10.
- Writing for any user-facing copy: no em or en dashes, no double-hyphen dashes, none of these words: seamless, leverage, empower, revolutionize, streamline, game-changer, cutting-edge, delve, robust, unlock, elevate, harness, effortless. Plain human tone with concrete numbers.
- Scope discipline: if something threatens the deadline, cut scope (for example drop signature 2) rather than polish. The held-out evaluation outranks every UI task.
- Keep `npm run build` passing after every change. The landing page and the 12 result pages run the pipeline at build time, so a pipeline exception breaks the build. Guard it.

## 5. Definition of done

- Deployed at https://kymora.vercel.app, and the README demo link works.
- `npm run eval` and `npm run eval -- --set ptbxl` both reproduce the README tables from a clean clone.
- The README has the Evaluation, Who benefits / who could be harmed, Limitations, One more month, Attribution and AI use sections filled in with real numbers.
- The 90-second demo flow works end to end: seeded strip, own photo, rejection, CSV, eval panel.
- Wow moment rehearsed with a real printed strip photographed on the desk, showing the measured and reference bpm side by side.
