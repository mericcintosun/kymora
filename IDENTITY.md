# IDENTITY (contract; every later phase obeys this file)

DIRECTION: D9 high-desert
GROUND: #f4e9d8 sand
SURFACE: #ecdcc3
DEEP: #e2cfae
LINE: #d2bd98
INK: #3a2c1e
ACCENT: #8e2f2f oxblood
ON_ACCENT: #f4e9d8
SECOND: #8c3041 wine
OK: #2e7d4f
WARN: #a8641c
BAD: #b3382c
FONT_DISPLAY: F9 Spectral (next/font/google: Spectral, weight: ["400", "600", "700"] is required)
FONT_BODY: Rubik (next/font/google: Rubik)
FONT_MONO: none
STRUCTURE: S2 landing-workspace
ARCHETYPE: L1 poster
MOTION: M3 scale, prefix kymora-
KIT: K2 gsap
RADIUS: soft
HEADER: solid ground, border-b in LINE, sticky
LOGO_POLICY: brand-mark

## Why

The farm assigned this identity so that no two projects share a look, a route map or an interaction style. The most recent projects it differs from: Global AI Builder’s Challenge (D17, S3, L5, K5); InnovateHER Hackathon: Girls Who Code (D14, S4, L6, K6); Acodemic X KeebsforWater Global SDG Hackathon (D8, S6, L3, K3). It is not a suggestion. Tie the product's own nouns to it; do not swap any row for a familiar one.

## Direction: D9 high-desert

Sand and terracotta light, sunbaked matte, wide horizons.

Surface treatment: Wide horizontal bands like strata, soft rounded panels in sand steps, sun-disc and horizon-line shapes, matte flat fills.

Every hex in app/globals.css comes from the key block above. RADIUS soft means 0.375rem on every card, panel and control. ON_ACCENT is the text color on an ACCENT fill. The semantic colors (OK, WARN, BAD) mark state only, never brand.

## Structure: S2 landing-workspace

A story landing page that leads into a separate workspace, with shareable result pages.

Route map (name the bracketed parts with the product's own words):
- `/` : the landing page
- `/<verb>` : the workspace, named with the product's own verb (for example `/measure`, never `/app` or `/dashboard`)
- `/<verb>/[id]` : one result as its own shareable page
- `/how` : method and sponsor tech

Rules:
- the landing's one CTA opens the workspace with an example already loaded
- every result has its own URL and a share or copy-link control
- the header has at most three links plus the CTA

## Archetype: L1 poster (the composition of the home route)

Full-bleed typographic hero: the display headline spans the full container at clamp(3.5rem, 9vw, 8rem), the CTA row sits beneath it, and the product appears only below the fold as one full-width live frame.

MUSTs: the headline is the largest element on screen; CTA inside the first viewport; the product frame is full-width.
Bans: any card in the first viewport; any side column at lg.

## Motion: M3 scale (the entrance signature)

scale(0.96) to 1 plus fade, ease-out, 380ms. One keyframe block implements it; every keyframe name starts with `kymora-`. A `prefers-reduced-motion: reduce` block disables it.

## Interaction kit: K2 gsap

GSAP with ScrollTrigger: timelines and pinned scroll scenes.

Packages for package.json dependencies: "gsap": "^3.15.1", "@gsap/react": "^2.1.2".

Typical import: `import gsap from "gsap"; import { ScrollTrigger } from "gsap/ScrollTrigger"; import { useGSAP } from "@gsap/react"; gsap.registerPlugin(useGSAP, ScrollTrigger);`

Signature interactions (the scaffold ships the first; all three exist by the end of the frontend phase):
1. a pinned scroll scene: one section pins while a scrubbed timeline plays the product's core transformation (before to after) with seed numbers
2. an intro timeline on first paint: the headline is split into word spans by hand and staggered in, followed by the product frame
3. a figure tween bound to a control: clicking it tweens the displayed seed value and its chart mark together

Rules:
- every GSAP call lives inside `useGSAP(() => { ... }, { scope: ref })` so cleanup is automatic
- wrap motion in `gsap.matchMedia()` and skip it under `(prefers-reduced-motion: reduce)`
- add the packages above to package.json `dependencies` (and `devDependencies` where listed) with exactly these ranges; the runner installs them
- every import of a kit package lives in a component that starts with `"use client"`
- server HTML must be readable with JavaScript off: never server-render content at opacity 0 or off screen; animate from the visible state or on interaction
- honor `prefers-reduced-motion: reduce`: the content and every control stay usable with motion off
- every interaction is driven by the real seed data; a decorative animation with no product meaning does not count as a signature

## Amendments (append-only; later phases add dated lines here, never edit anything above)
