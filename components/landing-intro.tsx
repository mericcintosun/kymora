"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

if (typeof window !== "undefined") gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Signature 2 (K2): the intro timeline on first paint, plus the L1 poster hero it plays on.
 *
 * The headline is split into word spans by hand, the words stagger in, then the frame
 * (the element marked data-intro-frame inside `frame`) scales in from 0.96. While the
 * visitor scrolls out of the hero, a scrubbed tween eases the headline down to 92%
 * from its bottom left corner, so the poster settles as the product frame arrives. A
 * transform never moves layout, so the CTA stays where the server put it.
 *
 * The server HTML is the finished, visible state: GSAP only animates after hydration,
 * and the matchMedia guard skips everything under prefers-reduced-motion.
 */
export function LandingIntro({ headline, children, frame }: { headline: string; children: ReactNode; frame: ReactNode }) {
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
        gsap.to("[data-headline]", {
          scale: 0.92,
          transformOrigin: "0% 100%",
          ease: "none",
          scrollTrigger: { trigger: ref.current?.querySelector("[data-hero]") ?? undefined, start: "top top", end: "bottom top", scrub: true },
        });
      }, ref.current ?? undefined);
      return () => mm.revert();
    },
    { scope: ref }
  );

  return (
    <div ref={ref}>
      <section data-hero className="relative overflow-hidden">
        {/* The sun sits half-sunk on the horizon line at the hero's base, never behind the words. */}
        <div
          aria-hidden
          data-sun-disc
          className="pointer-events-none absolute bottom-0 right-[6%] hidden size-[15rem] translate-y-1/2 rounded-full bg-deep md:block"
        />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-line" />
        <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] max-w-6xl flex-col justify-center px-5 py-12 sm:py-16">
          <h1
            data-headline
            className="break-words text-[clamp(3.5rem,9vw,8rem)] font-bold leading-[0.95] tracking-tight"
          >
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
      </section>
      {frame}
    </div>
  );
}
