# DELIVERY: Kymora prize categories

Kymora targets the four organizer categories of AI for Medicine: A Global Student Hackathon on the Future of Care. All four are automatic: the organizer panel scores every submission, so there is no separate form, sponsor SDK or integration per category. Step numbers refer to `DEMO.md`. The main deadline (4 December 2026, 23:45 EST) applies to all four, so no per-category deadline is listed.

## Grand Prize

- entryMode: automatic
- action: none, the organizer panel scores all submissions
- watch: 2 (trace and scale on `/digitize`), through 6 (figure tween on `/how`)
- code: `lib/kymora/pipeline.ts`, `scripts/eval.ts`

## Excellence in Research & Reproducibility

- entryMode: automatic
- action: none, the organizer panel scores all submissions
- watch: 5 (evaluation and limits on `/how`)
- code: `scripts/eval.ts`, `scripts/ptbxl/make_set.py`, `components/held-out-panel.tsx`

## Best Presentation

- entryMode: automatic
- action: none, the organizer panel scores all submissions
- watch: 7 (shareable result on `/digitize/sinus-72-tilted`)
- code: `components/result-view.tsx`, `app/digitize/[id]/page.tsx`

## Best Logo

- entryMode: automatic
- action: none, the organizer panel scores all submissions
- watch: 1 (landing, brand mark in the header)
- code: `public/logo.svg`, `components/brand-mark.tsx`

## Before submitting

A checklist for the human builder. None of these can be done or verified by the coding agent.

- [ ] Confirm the live URL in the README matches the one pasted in the Devpost form.
- [ ] Check that the Devpost form has no category checkbox (this was not verified). If it has one, tick all four categories above.
- [ ] Upload the logo: `public/logo.svg` rendered to PNG, or the raster at `public/brand/logo.png` if you add one.
- [ ] Verify the PTB-XL and ECG-Image-Kit licenses on their own pages before publishing derived images or reference waveforms.
- [ ] Record the video yourself, at least 60 s, following `DEMO.md` steps 1 to 7.
- [ ] Finish the Phase 2 checklist and `npm run lookup` from `HANDOFF.md` (held-out set, results file, `ADAPTER_MODE=real`, redeploy).
- [ ] Confirm eligibility for every team member: student, age 14 or older.
