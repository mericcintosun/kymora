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
  /** The uncalibrated baseline's rate on the same image; null when it reports none. */
  baselineHr: number | null;
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
 * Signature interaction 1 (K2): a pinned scroll scene. From 768 px up the section pins for
 * 900 px while a scrubbed timeline plays the real transformation on a seeded strip: the
 * paper starts at the strip's true tilt and turns flat, the grid fades, the digitized trace
 * draws over the ink, the R peaks appear and the rate settles from the uncalibrated
 * baseline's reading to Kymora's. Phones get the same scrub without a pin.
 *
 * Every number is a pipeline output computed at build time (app/page.tsx). The server HTML
 * is the finished state, so the frame reads fine with JavaScript or motion turned off; the
 * matchMedia guard skips all of it under prefers-reduced-motion. Scrolling is the only
 * input, so keyboard and screen reader users get the same end state as the stacked text.
 */
export function StripScene({ data }: { data: SceneData }) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const section = ref.current;
      if (!section) return;
      const frame = section.querySelector<HTMLElement>("[data-scene-frame]");
      const hrEl = section.querySelector<HTMLElement>("[data-hr]");

      const build = (wide: boolean) => {
        // M3 framed entrance: the CSS kymora-enter keyframe, added once the frame scrolls into view.
        if (frame) {
          ScrollTrigger.create({
            trigger: frame,
            start: "top 88%",
            once: true,
            onEnter: () => frame.classList.add("kymora-enter"),
          });
        }

        const counter = { v: data.baselineHr ?? data.heartRateBpm };
        const tl = gsap.timeline({
          defaults: { ease: "none" },
          scrollTrigger: wide
            ? { trigger: section, start: "top top", end: "+=900", scrub: 0.6, pin: true }
            : { trigger: frame ?? section, start: "top 80%", end: "bottom 25%", scrub: 0.6 },
        });
        tl.fromTo("[data-stage-on]", { scaleX: 0 }, { scaleX: 0, duration: 0.01 }, 0)
          .to("[data-stage-on='0']", { scaleX: 1, duration: 0.3 }, 0)
          .fromTo("[data-paper]", { rotation: data.trueSkewDeg, svgOrigin: "125 20" }, { rotation: 0, svgOrigin: "125 20", duration: 1 }, 0.3)
          .to("[data-stage-on='1']", { scaleX: 1, duration: 0.3 }, 0.6)
          .fromTo("[data-grid]", { opacity: 1 }, { opacity: 0.18, duration: 0.8 }, 1.4)
          .to("[data-stage-on='2']", { scaleX: 1, duration: 0.3 }, 1.5)
          .fromTo("[data-trace]", { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.4 }, 2.2)
          .to("[data-stage-on='3']", { scaleX: 1, duration: 0.3 }, 2.3)
          .fromTo("[data-peak]", { scale: 0, transformOrigin: "50% 50%" }, { scale: 1, stagger: 0.08, duration: 0.2 }, 3.5)
          .to("[data-stage-on='4']", { scaleX: 1, duration: 0.3 }, 3.6);
        if (data.baselineHr !== null && hrEl) {
          // From the baseline's number on the same image to Kymora's: two real readings, nothing invented.
          tl.fromTo(
            counter,
            { v: data.baselineHr },
            {
              v: data.heartRateBpm,
              duration: 0.8,
              onUpdate: () => {
                hrEl.textContent = Math.round(counter.v).toString();
              },
            },
            3.6
          );
        }
      };

      const mm = gsap.matchMedia();
      mm.add("(min-width: 768px) and (prefers-reduced-motion: no-preference)", () => build(true), section);
      mm.add("(max-width: 767px) and (prefers-reduced-motion: no-preference)", () => build(false), section);
      return () => mm.revert();
    },
    { scope: ref }
  );

  return (
    <section ref={ref} aria-labelledby="scene-title" className="relative flex flex-col justify-center bg-surface py-12 md:min-h-svh">
      <div className="mx-auto w-full max-w-6xl px-5">
        <h2 id="scene-title" className="text-3xl font-semibold sm:text-4xl">
          One strip, from photo to beats
        </h2>
        <p className="mt-2 max-w-[65ch] text-muted-foreground">
          {data.title}, a seeded synthetic strip. These are the real pipeline numbers, computed when the page was built.
        </p>
      </div>

      <figure data-scene-frame className="mt-8 w-full border-y border-border bg-ground">
        {/* Below 768 px the drawing keeps a readable width and scrolls sideways in its own box. */}
        <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Strip drawing, scrolls sideways on small screens">
          <svg
            viewBox="-6 -4 262 48"
            className="block h-auto w-full min-w-[40rem] md:min-w-0"
            role="img"
            aria-label={`Paper ECG strip with the digitized trace and ${data.peaks.length} R peaks marked`}
          >
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
        </div>
      </figure>

      <div className="mx-auto mt-8 w-full max-w-6xl space-y-6 px-5">
        <ol className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
          {STAGES.map((s, i) => (
            <li key={s} className="relative border-b-2 border-line pb-1">
              {s}
              <span aria-hidden data-stage-on={i} className="absolute inset-x-0 -bottom-0.5 h-0.5 origin-left bg-oxblood" />
            </li>
          ))}
        </ol>
        <p className="max-w-[75ch] text-lg leading-relaxed">
          Kymora measured{" "}
          <span className="font-display text-5xl font-bold text-oxblood" data-hr>
            {Math.round(data.heartRateBpm)}
          </span>{" "}
          bpm, mean RR {Math.round(data.meanRrMs)} ms, against a true rate of {data.referenceHr.toFixed(1)} bpm. It read the
          grid at {data.pxPerMm.toFixed(2)} px/mm and the tilt as {data.skewDeg.toFixed(1)}° (true {data.trueSkewDeg.toFixed(1)}°),
          quality {data.quality.toFixed(2)}.{" "}
          {data.baselineHr !== null
            ? `The uncalibrated baseline reads ${Math.round(data.baselineHr)} bpm on the same image.`
            : "The uncalibrated baseline reports no rate on the same image."}
        </p>
      </div>
    </section>
  );
}
