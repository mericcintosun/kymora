"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") gsap.registerPlugin(useGSAP);

/**
 * Signature 2 (K2): the intro timeline on first paint. The headline is split into word
 * spans by hand, the words stagger in, then the product frame (anything marked
 * data-intro-frame inside children) scales in. The server HTML is the finished, visible
 * state: GSAP only animates after hydration, and the matchMedia guard skips it entirely
 * under prefers-reduced-motion, so the headline is readable with JS or motion off.
 */
export function LandingIntro({ headline, children }: { headline: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const words = headline.split(" ");

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
        tl.from("[data-word]", { yPercent: 35, opacity: 0, duration: 0.5, stagger: 0.07, clearProps: "transform,opacity" }).from(
          "[data-intro-frame]",
          { scale: 0.96, opacity: 0, duration: 0.38, ease: "power1.out", clearProps: "transform,opacity" },
          "-=0.15"
        );
      });
      return () => mm.revert();
    },
    { scope: ref }
  );

  return (
    <div ref={ref}>
      <h1 className="break-words text-[clamp(3.5rem,9vw,8rem)] font-bold leading-[0.95] tracking-tight text-foreground">
        {words.map((w, i) => (
          <span key={`${w}-${i}`}>
            <span data-word className="inline-block">
              {w}
            </span>
            {i < words.length - 1 ? " " : null}
          </span>
        ))}
      </h1>
      {children}
    </div>
  );
}
