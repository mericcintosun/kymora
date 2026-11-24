import type { Metadata } from "next";
import Link from "next/link";
import { BenchPanel } from "@/components/bench-panel";
import { SceneSlot } from "@/components/scene-slot";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdapter } from "@/lib/adapter";
import { CONFIG } from "@/lib/kymora/pipeline";

export const metadata: Metadata = {
  title: "Method and evaluation",
  description: "How Kymora calibrates, digitizes and measures a paper ECG strip, and how its accuracy is tested on held-out data.",
};

const steps = [
  {
    name: "Grid and ink masks",
    fn: "splitChannels, buildMasks",
    body: "Each pixel gets a luminance and a redness value (red minus the mean of green and blue). Pixels pinker than the paper are grid; pixels darker than 60% of the paper level and not pink are ink.",
  },
  {
    name: "Tilt",
    fn: "estimateSkew",
    body: `The grid mask is projected onto rows at every angle from -${CONFIG.maxSkewDeg}° to +${CONFIG.maxSkewDeg}° in ${CONFIG.skewStepDeg}° steps. Horizontal grid lines collapse into sharp peaks only at the true tilt; a parabola through the best three angles refines it.`,
  },
  {
    name: "Scale from the paper itself",
    fn: "gridPeriod (autocorrelation)",
    body: "The column and row profiles of the deskewed grid are autocorrelated. The first clear peak is the 1 mm spacing, the peak at five times that lag is the 5 mm box and refines the estimate. This gives pixels per millimetre separately for time and voltage.",
  },
  {
    name: "Trace",
    fn: "extractTrace, traceToSignal",
    body: "With the grid masked out, each column's ink centroid becomes one sample. Gaps are bridged linearly, the median row is the isoelectric line, and 25 mm/s and 10 mm/mV turn pixels into milliseconds and millivolts, resampled to 250 Hz.",
  },
  {
    name: "Beats",
    fn: "detectRPeaks (Pan-Tompkins)",
    body: "Band-pass by moving averages, five-point derivative, squaring, 150 ms integration window, adaptive signal and noise thresholds, a 200 ms refractory period, T-wave rejection and search-back for missed beats. Heart rate is 60000 over the mean RR.",
  },
  {
    name: "Quality gate",
    fn: "digitize",
    body: `Quality = 0.55 × grid score + 0.45 × trace continuity score. Below ${CONFIG.qualityThreshold}, or with fewer than three beats, a non-square grid, under ${CONFIG.minDurationS} s of trace, or a rate outside ${CONFIG.minHeartRate} to ${CONFIG.maxHeartRate} bpm, no number is shown.`,
  },
];

export default function HowPage() {
  const bench = getAdapter().getBenchConfig();

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="max-w-[18ch] text-5xl font-bold sm:text-6xl">How Kymora measures, and how we check it</h1>
      <p className="mt-5 max-w-[68ch] text-lg text-muted-foreground">
        No model, no prompt. A signal-processing chain in plain TypeScript, in{" "}
        <code className="rounded-md bg-surface px-1.5 py-0.5 text-base">lib/kymora/pipeline.ts</code>, that runs unchanged in
        your browser and in Node for the evaluation.
      </p>

      <div className="mt-10">
        <SceneSlot
          n={3}
          alt="Four sand-coloured panels stepping down like rock strata: a tilted ECG photo, the same strip straightened with grid ticks, a green trace with the grid gone, and red dots on each heartbeat"
          width={960}
          height={640}
          className="mx-auto max-w-3xl rounded-md border border-border"
        />
      </div>

      <section className="mt-16">
        <h2 className="text-4xl font-semibold">The pipeline</h2>
        <ol className="mt-8 divide-y divide-border border-y border-border">
          {steps.map((s) => (
            <li key={s.name} className="grid gap-2 py-6 md:grid-cols-[16rem_1fr] md:gap-8">
              <div>
                <h3 className="font-display text-xl font-semibold">{s.name}</h3>
                <code className="text-sm text-muted-foreground">{s.fn}</code>
              </div>
              <p className="max-w-[68ch] leading-relaxed">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16 space-y-6">
        <h2 className="text-4xl font-semibold">Evaluation</h2>
        <p className="max-w-[68ch] leading-relaxed">
          Two layers. The synthetic bench below runs in your tab and in <code>npm run eval</code> with the same seed, so a
          stranger gets the same table. The held-out clinical set is PTB-XL fold 10 (the test fold its authors
          recommend), with lead II rhythm strips rendered as paper images by ECG-Image-Kit from a fixed seed and
          configuration; its loader is wired in <code>scripts/eval.ts</code> and its numbers are added to the README once
          that set is generated.
        </p>
        <BenchPanel seed={bench.seed} n={bench.n} />
        <Card>
          <CardHeader>
            <CardTitle>Reproduce it</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <code>npm install</code> then <code>npm run eval</code> (seed 42, 200 strips, writes{" "}
              <code>eval/results.json</code>). Change the seed or size with <code>npm run eval -- --seed 7 --n 500</code>.
            </p>
            <p className="text-muted-foreground">
              Every threshold the pipeline uses lives in the exported <code>CONFIG</code> object and is printed with the
              results.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-16 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Who benefits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 leading-relaxed text-muted-foreground">
            <p>Clinicians far from a cardiologist who share strips as phone photos and today get a measurement done by eye.</p>
            <p>Researchers sitting on archives of paper ECGs that never made it into a database.</p>
            <p>Patients, indirectly, when their old printouts become comparable to new digital recordings.</p>
          </CardContent>
        </Card>
        <Card className="border-bad">
          <CardHeader>
            <CardTitle>Who could be harmed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 leading-relaxed text-muted-foreground">
            <p>
              A patient with bradycardia, if a wrong calibration reports 60 bpm for a true 40 and the slow rate is missed.
              This is why the gate refuses implausible scale and why the bench reports error by sign.
            </p>
            <p>
              Anyone whose strip looks unlike our test images (black and white copies, no grid, a different paper speed).
              Kymora assumes 25 mm/s and 10 mm/mV; a 50 mm/s strip would halve the rate unless the user knows.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-16 max-w-[70ch] space-y-4">
        <h2 className="text-4xl font-semibold">Limits we know about</h2>
        <ul className="list-disc space-y-2 pl-5 leading-relaxed">
          <li>One lead, lead II rhythm strips only. A full 12-lead page must be cropped first.</li>
          <li>Colour-based grid detection: grey or black grids are not supported and are rejected.</li>
          <li>Tilt is corrected; perspective (photo taken at an angle) is only detected, not corrected.</li>
          <li>Synthetic strips are cleaner than real photos. Real-photo results will be reported separately and will be worse.</li>
          <li>Heart rate and RR only. No rhythm labels, intervals like QT, or diagnosis.</li>
        </ul>
        <Button asChild className="mt-4">
          <Link href="/digitize">Try it on a strip</Link>
        </Button>
      </section>

      <section className="mt-16 max-w-[70ch] space-y-3 text-sm text-muted-foreground">
        <h2 className="text-2xl font-semibold text-foreground">Credits</h2>
        <p>Pan J, Tompkins WJ. A real-time QRS detection algorithm. IEEE Trans Biomed Eng. 1985;32(3):230-236.</p>
        <p>Wagner P, et al. PTB-XL, a large publicly available electrocardiography dataset. Sci Data. 2020;7:154. PhysioNet.</p>
        <p>Shivashankara KK, et al. ECG-Image-Kit: a synthetic image generation toolbox. Physiol Meas. 2024. PhysioNet Challenge 2024 tooling.</p>
        <p>Reyna MA, et al. Digitization and classification of ECG images: the George B. Moody PhysioNet Challenge 2024.</p>
      </section>
    </div>
  );
}
