# DEMO: Kymora in 90 seconds

**Problem.** Millions of ECGs only exist on paper, and a phone photo of a rhythm strip gets measured by eye with a ruler.

**Trigger.** A clinician has a printed lead II strip and needs heart rate and RR intervals as data, today, without uploading a patient image anywhere.

**Wow moment.** A tilted phone photo of a printed strip is dropped, the green trace settles on the ink, and "72 bpm, RR 833 ms" appears next to the reference value.

**Start route:** `/` (`app/page.tsx`).

## Steps

1. **0:00 to 0:10, landing.** `/` (`app/page.tsx`). The poster headline fills the first viewport. Click the CTA "Digitize an example strip", which opens `/digitize?strip=sinus-72-tilted`.
2. **0:10 to 0:25, trace and scale.** `/digitize` (`app/digitize/page.tsx`, `components/workspace.tsx`). The seeded tilted strip loads (or drop a photo on the drop zone). The green trace sits on the ink, and the calibration card shows px/mm and the tilt in degrees.
3. **0:25 to 0:40, beats and export.** `/digitize` (`app/digitize/page.tsx`). R peaks are marked, heart rate and mean RR appear with the reference value and the signed error beside them. Click "Download CSV (mV, 250 Hz)".
4. **0:40 to 0:45, refusal.** `/digitize?strip=blurred-75-motion` (`app/digitize/page.tsx`). The motion-blurred strip gets "No reliable measurement", the quality score against the 0.60 gate, and the reasons. No number is shown.
5. **0:45 to 1:15, evaluation and limits.** `/how` (`app/how/page.tsx`). In a terminal, `npm run eval` (seed 42) prints the bench table. On the page, run the same bench in the browser, then scroll to the "Who benefits" and "Who could be harmed" cards and the limits list.
6. **1:15 to 1:30, shareable result and close.** `/digitize/sinus-72-tilted` (`app/digitize/[id]/page.tsx`). The same result as its own URL with "Copy result link", plus the baseline comparison. Close on the Kymora logo.

## Notes for the recording

- All twelve seeded strips are synthetic (`lib/kymora/synth.ts`), and the UI labels them that way.
- The real desk photo of a printed PTB-XL fold 10 strip (the wow moment with a physical strip) is recorded by the builder after Phase 2, once the held-out set exists.
- Step 5: with `ADAPTER_MODE=real` and a committed `eval/ptbxl-results.json`, `/how` shows the held-out PTB-XL fold 10 table (renderer named) above the live synthetic bench. Without them, it says in one sentence that the held-out set is not generated in this build. In the terminal, `npm run eval -- --set ptbxl` prints the same table.
