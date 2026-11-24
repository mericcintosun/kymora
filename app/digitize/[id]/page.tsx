import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalResult } from "@/components/local-result";
import { ResultView } from "@/components/result-view";
import { SceneSlot } from "@/components/scene-slot";
import { SourceNote } from "@/components/source-note";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getAdapter } from "@/lib/adapter";
import { LOG_PREFIX } from "@/lib/config";

export function generateStaticParams() {
  return getAdapter()
    .listStrips()
    .map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const strip = getAdapter().getStrip(id);
  return { title: strip ? `Result: ${strip.title}` : "Result from your photo" };
}

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (id.startsWith("local-")) {
    return (
      <div className="mx-auto max-w-6xl px-5 py-12">
        <h1 className="text-5xl font-bold">Result from your photo</h1>
        <div className="mt-8">
          <LocalResult id={id} />
        </div>
      </div>
    );
  }

  const adapter = getAdapter();
  const strip = adapter.getStrip(id);
  if (!strip) notFound();

  // Computed on the server with the same pipeline the browser runs. A throw is logged
  // and rethrown so app/digitize/[id]/error.tsx renders; it is never swallowed.
  let run: ReturnType<typeof adapter.getRun>;
  try {
    run = adapter.getRun(strip.id);
  } catch (e) {
    console.error(`${LOG_PREFIX} run failed id=${strip.id}`);
    throw e;
  }
  if (!run) notFound();
  const k = run.kymora;
  const b = run.baseline;

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <p className="text-sm text-muted-foreground">
        <Link href="/digitize" className="inline-block py-3 underline decoration-line underline-offset-4 hover:decoration-primary">
          Workspace
        </Link>{" "}
        / result
      </p>
      <h1 className="mt-1 break-words text-5xl font-bold sm:text-6xl">{strip.title}</h1>
      <p className="mt-4 max-w-[68ch] text-lg text-muted-foreground">{strip.scenario}</p>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="secondary">{strip.stress}</Badge>
        <span className="text-muted-foreground">{strip.capture}</span>
      </p>
      <div className="mt-5 max-w-[68ch]">
        <SourceNote mode={adapter.mode} heldOut={adapter.getHeldOut()} />
      </div>

      <div className="mt-10">
        <ResultView
          label={strip.title}
          measurement={k}
          params={strip.params}
          reference={{ heartRateBpm: run.reference.heartRateBpm, meanRrMs: run.reference.meanRrMs }}
          resultPath={`/digitize/${strip.id}`}
          onResultPage
        />
      </div>

      <section className="mt-14 max-w-[70ch]">
        <h2 className="text-3xl font-semibold">Same photo, no calibration</h2>
        <p className="mt-3 leading-relaxed">
          The baseline assumes a 300 DPI scan ({(300 / 25.4).toFixed(2)} px/mm), takes the darkest pixel in each column and
          has no quality gate. On this strip it reports{" "}
          <strong>{b.heartRateBpm !== null ? `${b.heartRateBpm.toFixed(0)} bpm` : "no rate"}</strong> against a reference of{" "}
          {run.reference.heartRateBpm.toFixed(1)} bpm, because the photo&apos;s real scale is{" "}
          {strip.params.pxPerMm.toFixed(1)} px/mm. Kymora read the scale from the grid as{" "}
          {k.pxPerMmX !== null ? `${k.pxPerMmX.toFixed(2)} px/mm` : "unreadable"}.
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link href={`/digitize?strip=${strip.id}`}>Reopen in the workspace</Link>
        </Button>
      </section>

      <div className="mt-14 max-w-md">
        <SceneSlot n={4}
          alt="A straightened ECG strip resting on stepped sand panels, a green trace on the ink with oxblood dots on each beat, and a sun disc above the horizon line"
          width={800}
          height={720}
          className="rounded-md border border-border"
        />
      </div>
    </div>
  );
}
