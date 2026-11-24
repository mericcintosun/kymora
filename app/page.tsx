import type { Metadata } from "next";
import Link from "next/link";
import { SceneSlot } from "@/components/scene-slot";
import { LandingIntro } from "@/components/landing-intro";
import { EmptyState } from "@/components/states";
import { StripScene, type SceneData } from "@/components/strip-scene";
import { Button } from "@/components/ui/button";
import { FEATURED_STRIP_ID, strips, type StripSeed } from "@/lib/data";
import { runStrip, type StripRun } from "@/lib/kymora/bench";
import { CONFIG } from "@/lib/kymora/pipeline";
import { STRIP } from "@/lib/kymora/synth";
import { cn } from "@/lib/utils";

// The landing page keeps the brand line as its full title instead of the "%s | Kymora" template.
export const metadata: Metadata = {
  title: { absolute: "Kymora: paper ECG strips measured on-device" },
};

const HEADLINE = "Paper ECG strips, measured in your browser.";

/** What Kymora refuses to do, one sentence each, drawn as strata bands. */
const REFUSALS = [
  {
    name: "No diagnosis.",
    body: "It reports heart rate and RR intervals from one lead II strip, and never labels a rhythm or reads an ST segment.",
    band: "bg-surface",
  },
  {
    name: "No guess on a bad photo.",
    body: `A quality score from grid sharpness and trace continuity gates every result, and below ${CONFIG.qualityThreshold.toFixed(2)} you get the reasons and no number.`,
    band: "bg-deep",
  },
  {
    name: "No upload.",
    body: "The photo is read from a canvas in your tab, and no server route accepts images.",
    band: "bg-surface",
  },
];

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

function pathFrom(points: Array<[number, number]>): string {
  return points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join("");
}

/** Turns one real pipeline run into millimetre paths for the pinned scene. Null when a figure is missing. */
function sceneFor(strip: StripSeed, run: StripRun): SceneData | null {
  const ref = run.reference;
  const k = run.kymora;
  if (k.heartRateBpm === null || k.meanRrMs === null || k.pxPerMmX === null) return null;
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
    pxPerMm: k.pxPerMmX,
    heartRateBpm: k.heartRateBpm,
    baselineHr: run.baseline.heartRateBpm,
    referenceHr: ref.heartRateBpm,
    meanRrMs: k.meanRrMs,
    quality: k.quality,
    inkPath: pathFrom(ink),
    tracePath: pathFrom(trace),
    peaks,
  };
}

/**
 * The featured strip first, then the rest from the most tilted down, so the scene shows a
 * visible tilt whenever a tilted strip is accepted with a rate. Guarded: a pipeline throw at
 * build time skips that strip instead of breaking the static build.
 */
function featuredScene(): SceneData | null {
  const featured = strips.filter((s) => s.id === FEATURED_STRIP_ID);
  const rest = strips
    .filter((s) => s.id !== FEATURED_STRIP_ID)
    .sort((a, b) => Math.abs(b.params.skewDeg) - Math.abs(a.params.skewDeg));
  for (const strip of [...featured, ...rest]) {
    try {
      const run = runStrip(strip.params);
      if (run.kymora.accepted && run.kymora.heartRateBpm !== null) {
        const scene = sceneFor(strip, run);
        if (scene) return scene;
      }
    } catch {
      continue;
    }
  }
  return null;
}

export default function Home() {
  const scene = featuredScene();

  return (
    <>
      {/* L1 poster: the headline owns the first viewport, no cards, no side column. */}
      <LandingIntro
        headline={HEADLINE}
        frame={
          <div>
            <div data-intro-frame className="w-full">
              <SceneSlot n={1}
                alt="A printed pink-grid ECG strip lying tilted across sand-coloured strata like a horizon, a phone above it showing the green trace, and a low sun disc behind"
                width={1600}
                height={280}
                className="block"
              />
            </div>
            <div aria-hidden data-strata="hero">
              <div className="h-3 bg-deep" />
              <div className="h-2 bg-line" />
              <div className="h-1.5 bg-oxblood" />
            </div>
          </div>
        }
      >
        <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-muted-foreground sm:mt-8 sm:text-xl">
          For clinicians who get rhythm strips as phone photos. Kymora reads the paper&apos;s 1 mm grid, fixes up to{" "}
          {CONFIG.maxSkewDeg}° of tilt and reports heart rate and RR intervals, with nothing uploaded and no number below a
          quality of {CONFIG.qualityThreshold.toFixed(2)}.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 sm:mt-9">
          <Button asChild size="lg">
            <Link href={`/digitize?strip=${FEATURED_STRIP_ID}`}>Digitize an example strip</Link>
          </Button>
          <Link
            href="/how"
            className="inline-flex min-h-11 items-center text-base underline decoration-line decoration-2 underline-offset-4 hover:decoration-primary"
          >
            See how we test accuracy
          </Link>
        </div>
      </LandingIntro>

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
        <h2 className="max-w-[20ch] text-4xl font-semibold sm:text-5xl">Millions of ECGs still live on paper.</h2>
        <p className="mt-5 max-w-[65ch] text-lg leading-relaxed">
          A GP at a rural health post photographs a rhythm strip for a cardiologist, who then measures it by eye with a
          ruler.
        </p>
        <details className="group mt-6 rounded-md border border-border bg-surface p-4 text-base">
          <summary className="cursor-pointer py-2.5 font-medium">Why this is a real gap, in one line: the 2024 PhysioNet Challenge was about exactly this.</summary>
          <div className="mt-3 max-w-[65ch] space-y-3 text-muted-foreground">
            <p>
              The George B. Moody PhysioNet Challenge 2024 asked teams to digitize ECG images, scoring them by
              signal-to-noise ratio against the original recordings. The open tools we found ship as Python pipelines,
              MATLAB code or desktop downloads, and the web tools we found upload the image to a server.
            </p>
            <p>
              Kymora runs entirely in the browser, keeps the patient image on the device, adds the rhythm numbers a
              clinician actually asks for, and publishes its own held-out error table.
            </p>
          </div>
        </details>
        <div className="mt-10">
          <SceneSlot n={2}
            alt="A doctor at a small clinic table photographing a printed ECG strip with a phone, a message bubble carrying the photo to a distant cardiologist"
            width={960}
            height={640}
            className="mx-auto max-w-3xl rounded-md border border-border"
          />
        </div>
      </section>

      <section className="pt-24">
        <div className="mx-auto max-w-6xl px-5">
          <h2 className="text-4xl font-semibold sm:text-5xl">What it will not do</h2>
        </div>
        <ul data-strata="limits" className="mt-8 border-y border-border">
          {REFUSALS.map((r) => (
            <li key={r.name} className={cn("border-b border-border last:border-b-0", r.band)}>
              <p className="mx-auto max-w-6xl px-5 py-6 text-lg leading-relaxed">
                <span className="font-display text-2xl font-semibold">{r.name}</span>{" "}
                <span className="text-muted-foreground">{r.body}</span>
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-24">
        <h2 className="text-4xl font-semibold sm:text-5xl">Try a seeded strip</h2>
        <p className="mt-3 max-w-[65ch] text-lg text-muted-foreground">
          Each strip is drawn from a seed with a known true rate, then tilted, blurred and shaded like a phone photo.
        </p>
        <details className="mt-6 rounded-md border border-border bg-surface">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 py-2.5 font-medium">
            Twelve seeded strips, each with its own result page
          </summary>
          <ul className="divide-y divide-border border-t border-border">
            {strips.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/digitize/${s.id}`}
                  className="flex min-h-11 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-deep"
                >
                  <span className="font-display text-lg font-semibold">{s.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {s.params.heartRateBpm} bpm nominal, {s.stress}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      </section>

      <section className="pt-24">
        <p className="mx-auto max-w-6xl px-5 pb-6 font-display text-2xl font-semibold sm:text-3xl">
          The paper is the ruler; the browser does the reading.
        </p>
        <SceneSlot n={6}
          alt="A wide desert horizon in sand strata at dusk, an oxblood sun disc half set behind it, and a straightened ECG strip lying flat along the horizon line"
          width={1600}
          height={240}
          className="block"
        />
      </section>
    </>
  );
}
