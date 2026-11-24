import type { AdapterMode, HeldOutResults } from "@/lib/types";

const RENDERER_NAME: Record<HeldOutResults["renderer"], string> = {
  "ecg-image-kit": "ECG-Image-Kit",
  matplotlib: "a seeded matplotlib renderer (the ECG-Image-Kit fallback)",
};

/**
 * One plain line saying where the numbers on the page come from. Server component: it
 * receives the facts, it reads nothing itself.
 *
 *   scope "strip"       a seeded result page. Those strips are synthetic by design in every
 *                       mode (that is what gives an exact reference), so the line says so
 *                       and does not talk about the held-out set at all.
 *   scope "evaluation"  the /how evaluation section. Names the held-out source when it is
 *                       loaded, otherwise one muted line that it is not part of this deployment.
 */
export function SourceNote({
  mode,
  heldOut,
  scope,
}: {
  mode: AdapterMode;
  heldOut: Pick<HeldOutResults, "n" | "renderer" | "seed"> | null;
  scope: "strip" | "evaluation";
}) {
  if (scope === "strip") {
    return (
      <p className="rounded-md border border-border bg-surface px-4 py-2.5 text-sm leading-relaxed text-muted-foreground">
        Seeded synthetic strip: the waveform is generated from a fixed seed, so its true heart rate is known exactly and
        the reference column below is exact.
      </p>
    );
  }
  return (
    <p className="rounded-md border border-border bg-surface px-4 py-2.5 text-sm leading-relaxed text-muted-foreground">
      {mode === "real" && heldOut ? (
        <>
          <span className="font-semibold text-ok">Held-out source:</span> PTB-XL fold 10, {heldOut.n} images rendered by{" "}
          {RENDERER_NAME[heldOut.renderer]}, seed {heldOut.seed}.
        </>
      ) : (
        <>
          This deployment shows the synthetic bench. The held-out PTB-XL table is generated offline from a local PTB-XL
          copy and is not part of this build yet.
        </>
      )}
    </p>
  );
}
