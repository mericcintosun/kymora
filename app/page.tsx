import type { Metadata } from "next";
import Link from "next/link";
import { SceneSlot } from "@/components/scene-slot";
import { EmptyState } from "@/components/states";
import { StripScene, type SceneData } from "@/components/strip-scene";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FEATURED_STRIP_ID, strips, type StripSeed } from "@/lib/data";
import { runStrip, type StripRun } from "@/lib/kymora/bench";
import { STRIP } from "@/lib/kymora/synth";

// The landing page keeps the brand line as its full title instead of the "%s | Kymora" template.
export const metadata: Metadata = {
  title: { absolute: "Kymora: paper ECG strips, measured in your browser" },
};

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

function pathFrom(points: Array<[number, number]>): string {
  return points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join("");
}

/** Turns one real pipeline run into millimetre paths for the pinned scene. */
function sceneFor(strip: StripSeed, run: StripRun): SceneData {
  const ref = run.reference;
  const k = run.kymora;
  const refMedian = median(ref.mv);
  const toY = (mv: number) => STRIP.baselineMm - mv * 10;
  const ink: Array<[number, number]> = [];
  for (let i = 0; i < ref.mv.length; i += 2) ink.push([(i / ref.fs) * 25, toY(ref.mv[i])]);
  const trace: Array<[number, number]> = [];
  for (let i = 0; i < k.signal.mv.length; i += 2) trace.push([(k.signal.t0 + i / k.signal.fs) * 25, toY(k.signal.mv[i] + refMedian)]);
  const peaks: Array<[number, number]> = k.rPeaksMs.map((ms) => {
    const i = Math.max(0, Math.min(k.signal.mv.length - 1, Math.round((ms / 1000 - k.signal.t0) * k.signal.fs)));
    return [(ms / 1000) * 25, toY(k.signal.mv[i] + refMedian)];
  });
  return {
    title: strip.title,
    trueSkewDeg: strip.params.skewDeg,
    skewDeg: k.skewDeg,
    pxPerMm: k.pxPerMmX ?? 0,
    heartRateBpm: k.heartRateBpm ?? 0,
    referenceHr: ref.heartRateBpm,
    meanRrMs: k.meanRrMs ?? 0,
    quality: k.quality,
    inkPath: pathFrom(ink),
    tracePath: pathFrom(trace),
    peaks,
  };
}

function featuredScene(): SceneData | null {
  const order = [FEATURED_STRIP_ID, ...strips.map((s) => s.id).filter((id) => id !== FEATURED_STRIP_ID)];
  for (const id of order) {
    const strip = strips.find((s) => s.id === id);
    if (!strip) continue;
    const run = runStrip(strip.params);
    if (run.kymora.accepted) return sceneFor(strip, run);
  }
  return null;
}

export default function Home() {
  const scene = featuredScene();

  return (
    <>
      {/* L1 poster: the headline owns the first viewport, no cards, no side column. */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -right-24 top-10 size-[22rem] rounded-full bg-deep sm:size-[30rem]" />
        <div className="relative mx-auto max-w-6xl px-5 pb-10 pt-14 sm:pt-20">
          <h1 className="kymora-enter text-[clamp(3.5rem,9vw,8rem)] font-bold leading-[0.95] tracking-tight text-foreground">
            Paper ECG, read to the millisecond.
          </h1>
          <p className="kymora-enter kymora-enter-2 mt-8 max-w-[62ch] text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Drop a phone photo of a printed lead II rhythm strip. Kymora calibrates on the paper&apos;s own millimetre grid,
            turns the line into millivolts and milliseconds, and reports heart rate and RR intervals. When the photo
            cannot support a number, it says so instead of guessing. Nothing leaves your browser.
          </p>
          <div className="kymora-enter kymora-enter-3 mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button asChild size="lg">
              <Link href={`/digitize?strip=${FEATURED_STRIP_ID}`}>Digitize an example strip</Link>
            </Button>
            <Link href="/how" className="text-base underline decoration-line decoration-2 underline-offset-4 hover:decoration-primary">
              See how we test accuracy
            </Link>
          </div>
        </div>
        <div className="relative mx-auto max-w-6xl px-5">
          <SceneSlot
            n={1}
            alt="A printed pink-grid ECG strip lying across a sand-coloured desk like a horizon, a phone hovering above it and a low sun disc behind"
            width={1600}
            height={280}
            className="rounded-md"
          />
        </div>
        <div aria-hidden className="mt-10">
          <div className="h-2 bg-deep" />
          <div className="h-3 bg-line" />
          <div className="h-1.5 bg-second/70" />
        </div>
      </section>

      {scene ? (
        <StripScene data={scene} />
      ) : (
        <section className="mx-auto max-w-6xl px-5 py-16">
          <EmptyState
            title="No seeded strip passed the quality gate in this build"
            message="The live frame needs one accepted strip. Open the workspace to see the quality score and the reasons for each strip."
            cta={
              <Button asChild>
                <Link href={`/digitize?strip=${FEATURED_STRIP_ID}`}>Open the workspace</Link>
              </Button>
            }
          />
        </section>
      )}

      <section className="mx-auto max-w-6xl px-5 pt-24">
        <h2 className="text-4xl font-semibold sm:text-5xl">Millions of ECGs still live on paper.</h2>
        <div className="mt-8 space-y-10">
          <div className="space-y-5 text-lg leading-relaxed">
            <p className="max-w-[65ch]">
              A GP at a rural health post photographs a rhythm strip and sends it to a cardiologist, who measures it by eye
              with a ruler. A researcher with a cabinet of archived printouts cannot feed any of them to signal analysis.
            </p>
            <details className="group rounded-md border border-border bg-surface p-4 text-base">
              <summary className="cursor-pointer font-medium">Why this is a real gap, in one line: the 2024 PhysioNet Challenge was about exactly this.</summary>
              <div className="mt-3 max-w-[65ch] space-y-3 text-muted-foreground">
                <p>
                  The George B. Moody PhysioNet Challenge 2024 asked teams to digitize ECG images, scoring them by
                  signal-to-noise ratio against the original recordings. The open tools we found ship as Python
                  pipelines, MATLAB code or desktop downloads, and the web tools we found upload the image to a server.
                </p>
                <p>
                  Kymora runs entirely in the browser, keeps the patient image on the device, adds the rhythm numbers a
                  clinician actually asks for, and publishes its own held-out error table.
                </p>
              </div>
            </details>
          </div>
          <SceneSlot
            n={2}
            alt="A doctor at a small clinic table photographing a printed ECG strip with a phone, a message bubble carrying the photo to a distant cardiologist"
            width={960}
            height={640}
            className="mx-auto max-w-3xl rounded-md border border-border"
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-24">
        <h2 className="text-4xl font-semibold sm:text-5xl">What it will not do</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>No diagnosis</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Kymora reports heart rate and RR intervals from one lead II strip. It does not label rhythms or read ST
              segments.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>No guess on a bad photo</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              A quality score built from grid sharpness and trace continuity gates every result. Below 0.6, you get the
              reasons and no number.
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>No upload</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              The photo is read from a canvas in your tab. There is no server route that receives images.
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-24">
        <h2 className="text-4xl font-semibold sm:text-5xl">Twelve seeded strips to try</h2>
        <p className="mt-3 max-w-[68ch] text-muted-foreground">
          Each strip is rendered from a seed with a known true rate, then tilted, blurred and shaded like a real photo.
          Every one has its own result page.
        </p>
        <ul className="mt-8 divide-y divide-border border-y border-border">
          {strips.map((s) => (
            <li key={s.id}>
              <Link href={`/digitize/${s.id}`} className="flex flex-wrap items-baseline justify-between gap-3 px-1 py-4 hover:bg-surface">
                <span className="font-display text-lg font-semibold">{s.title}</span>
                <span className="flex items-center gap-3 text-sm text-muted-foreground">
                  {s.params.heartRateBpm} bpm nominal
                  <Badge variant="secondary">{s.stress}</Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
