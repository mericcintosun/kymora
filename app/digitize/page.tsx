import type { Metadata } from "next";
import { Workspace } from "@/components/workspace";
import { FEATURED_STRIP_ID, stripById, strips } from "@/lib/data";

export const metadata: Metadata = {
  title: "Workspace",
  description: "Digitize a paper ECG rhythm strip in your browser: grid calibration, trace, heart rate and RR intervals.",
};

export default async function DigitizePage({ searchParams }: { searchParams: Promise<{ strip?: string }> }) {
  const { strip } = await searchParams;
  const initialId = strip && stripById(strip) ? strip : FEATURED_STRIP_ID;

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-5xl font-bold sm:text-6xl">Digitize a strip</h1>
      <p className="mt-4 max-w-[68ch] text-lg text-muted-foreground">
        Pick a seeded strip or drop a photo. Kymora reads the paper at 25 mm/s and 10 mm/mV, so the grid itself is the
        ruler. Every result gets its own page you can link to.
      </p>
      <div className="mt-10">
        <Workspace strips={strips} initialId={initialId} />
      </div>
    </div>
  );
}
