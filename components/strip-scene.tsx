"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") gsap.registerPlugin(useGSAP, ScrollTrigger);

export interface SceneData {
  title: string;
  trueSkewDeg: number;
  skewDeg: number;
  pxPerMm: number;
  heartRateBpm: number;
  referenceHr: number;
  meanRrMs: number;
  quality: number;
  /** Paper ink path in millimetres (250 x 40 mm strip). */
  inkPath: string;
  /** Kymora's digitized trace in millimetres. */
  tracePath: string;
  peaks: Array<[number, number]>;
}

const STAGES = ["Photo arrives tilted", "Grid read and deskewed", "Grid removed", "Trace digitized", "Beats measured"];

/**
 * Signature interaction 1 (K2): a pinned scroll scene. The section pins while a
 * scrubbed timeline plays the real transformation on a seeded strip: the tilt the
 * pipeline estimated is undone, the grid fades, the digitized trace draws over the
 * ink and the measured rate counts up. The server HTML is the finished state, so
 * the frame reads fine with JavaScript or motion turned off.
 */
export function StripScene({ data }: { data: SceneData }) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const hrEl = ref.current?.querySelector<HTMLElement>("[data-hr]");
        const counter = { v: 0 };
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: { trigger: ref.current ?? undefined, start: "top top", end: "+=1600", scrub: 0.6, pin: true },
        });
        tl.fromTo("[data-stage]", { opacity: 0.35 }, { opacity: 0.35, duration: 0.01 }, 0)
          .fromTo("[data-stage='0']", { opacity: 0.35 }, { opacity: 1, duration: 0.3 }, 0)
          .fromTo("[data-paper]", { rotation: data.trueSkewDeg, svgOrigin: "125 20" }, { rotation: 0, svgOrigin: "125 20", duration: 1 }, 0.3)
          .to("[data-stage='1']", { opacity: 1, duration: 0.3 }, 0.6)
          .fromTo("[data-grid]", { opacity: 1 }, { opacity: 0.18, duration: 0.8 }, 1.4)
          .to("[data-stage='2']", { opacity: 1, duration: 0.3 }, 1.5)
          .fromTo("[data-trace]", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.4 }, 2.2)
          .to("[data-stage='3']", { opacity: 1, duration: 0.3 }, 2.3)
          .fromTo("[data-peak]", { scale: 0, transformOrigin: "50% 50%" }, { scale: 1, stagger: 0.08, duration: 0.2 }, 3.5)
          .to("[data-stage='4']", { opacity: 1, duration: 0.3 }, 3.6)
          .fromTo(
            counter,
            { v: 0 },
            {
              v: data.heartRateBpm,
              duration: 0.8,
              onUpdate: () => {
                if (hrEl) hrEl.textContent = Math.round(counter.v).toString();
              },
            },
            3.6
          );
      });
      return () => mm.revert();
    },
    { scope: ref }
  );

  return (
    <section ref={ref} aria-labelledby="scene-title" className="relative flex min-h-svh flex-col justify-center bg-surface py-12">
      <div className="mx-auto w-full max-w-6xl px-5">
        <h2 id="scene-title" className="text-3xl font-semibold sm:text-4xl">
          One strip, from photo to beats
        </h2>
        <p className="mt-2 max-w-[68ch] text-muted-foreground">
          {data.title}. This is the real pipeline output for this seeded strip, computed when the page was built.
        </p>
      </div>

      <figure className="mt-8 w-full border-y border-border bg-ground">
        <svg viewBox="-6 -4 262 48" className="block h-auto w-full" role="img" aria-label={`Paper ECG strip with the digitized trace and ${data.peaks.length} R peaks marked`}>
          <defs>
            <pattern id="kymora-minor" width="1" height="1" patternUnits="userSpaceOnUse">
              <path d="M1 0V1H0" fill="none" className="stroke-second" strokeOpacity="0.22" strokeWidth="0.06" />
            </pattern>
            <pattern id="kymora-major" width="5" height="5" patternUnits="userSpaceOnUse">
              <path d="M5 0V5H0" fill="none" className="stroke-second" strokeOpacity="0.5" strokeWidth="0.14" />
            </pattern>
          </defs>
          <g data-paper>
            <rect x="0" y="0" width="250" height="40" className="fill-ground stroke-line" strokeWidth="0.3" />
            <g data-grid>
              <rect x="0" y="0" width="250" height="40" fill="url(#kymora-minor)" />
              <rect x="0" y="0" width="250" height="40" fill="url(#kymora-major)" />
            </g>
            <path d={data.inkPath} fill="none" className="stroke-ink" strokeWidth="0.35" strokeLinejoin="round" />
          </g>
          <path
            data-trace
            d={data.tracePath}
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset="0"
            fill="none"
            className="stroke-ok"
            strokeWidth="0.45"
            strokeOpacity="0.9"
            strokeLinejoin="round"
          />
          {data.peaks.map(([x, y], i) => (
            <circle key={i} data-peak cx={x} cy={y - 1.6} r="0.9" className="fill-oxblood" />
          ))}
        </svg>
      </figure>

      <div className="mx-auto mt-8 w-full max-w-6xl space-y-6 px-5">
        <ol className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {STAGES.map((s, i) => (
            <li key={s} data-stage={i} className="border-b-2 border-line pb-1">
              {s}
            </li>
          ))}
        </ol>
        <p className="text-lg leading-relaxed">
          Measured{" "}
          <span className="font-display text-5xl font-bold text-oxblood" data-hr>
            {Math.round(data.heartRateBpm)}
          </span>{" "}
          bpm, mean RR {Math.round(data.meanRrMs)} ms. The generator&apos;s true rate is {data.referenceHr.toFixed(1)} bpm. Grid read at{" "}
          {data.pxPerMm.toFixed(2)} px/mm, tilt {data.skewDeg.toFixed(1)}° (true {data.trueSkewDeg.toFixed(1)}°), quality {data.quality.toFixed(2)}.
        </p>
      </div>
    </section>
  );
}
