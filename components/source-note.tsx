import type { AdapterMode, HeldOutResults } from "@/lib/types";

const RENDERER_NAME: Record<HeldOutResults["renderer"], string> = {
  "ecg-image-kit": "ECG-Image-Kit",
  matplotlib: "a seeded matplotlib renderer (the ECG-Image-Kit fallback)",
};

/**
 * One plain line saying where the numbers on the page come from, driven by the
 * selector's mode. Server component: it receives the facts, it reads nothing itself.
 */
export function SourceNote({ mode, heldOut }: { mode: AdapterMode; heldOut: Pick<HeldOutResults, "n" | "renderer" | "seed"> | null }) {
  return (
    <p className="rounded-md border border-border bg-surface px-4 py-2.5 text-sm leading-relaxed">
      {mode === "real" && heldOut ? (
        <>
          <span className="font-semibold text-ok">Live source:</span> PTB-XL fold 10, {heldOut.n} images rendered by{" "}
          {RENDERER_NAME[heldOut.renderer]}, seed {heldOut.seed}. Strip pages still use synthetic samples.
        </>
      ) : (
        <>
          <span className="font-semibold text-warn">Sample data:</span> seeded synthetic strips. The held-out PTB-XL
          results are not shown in this build.
        </>
      )}
    </p>
  );
}
