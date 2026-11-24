# HANDOFF: Kymora

You are picking up a working Next.js 15 scaffold. Read this file, then `IDENTITY.md`, then `CLAUDE.md` and `DEMO.md`, then `lib/kymora/pipeline.ts`. Start building right away; everything you need is here.

## QA fix pass, round 1 (2026-11-24)

Written without running anything (the agent cannot run commands). The runner's rebuild and `npm run proof` are the verification.

- **proof demo-reset FAILED** (featured `sinus-72-tilted` refused). Root cause, read from the code and the live scene readout ("tilt 0.5° (true 0.4°)" on the one strip that passed, 95% rejection on the synthetic bench): `estimateSkew` searched in 0.25° steps and refined with a parabola through a cusp-shaped energy peak, so it missed by about 0.1°. Across a 2000 px strip that leaves the 1 mm horizontal lines smeared by about 3.5 px, the row-profile autocorrelation (the `gy` grid strength) collapses and quality falls under 0.60. Fix: a second 0.02° pass around the coarse best (`CONFIG.skewFineStepDeg`), parabola offset clamped to half a step. No gate or threshold changed. Risk to watch: `blurred-75-motion` must still be refused below 0.60; if the next proof shows it above the gate while still refused for another reason, fix the check's wording per the note further down, never `CONFIG`.
- **data: "Sample data" notice on `/digitize/[id]` and `/how`.** On strip pages the note was wrong in kind: seeded strips are synthetic by design in every mode, so the page now says that in one muted line and no longer mentions the held-out set. On `/how` the held-out PTB-XL table genuinely is not in this build (see below), so one muted sentence says so and the empty state below it reads as reproduction steps. `components/source-note.tsx` gained a `scope` prop.

## QA fix pass, round 2 (2026-11-24)

Written without running anything; the runner's rebuild, `npm test` and `npm run proof` are the verification.

- **proof demo-reset FAILED again** (proof line "FAIL sinus-72-tilted: accepted, no bpm"; the check had failed, the strip was refused). Root cause, read from the live `/digitize/sinus-72-tilted` page: "Grid 39.94 px/mm" on a strip rendered at 8 px/mm, and "Only 2.0 s of trace". `gridPeriod` locked onto the 5 mm box spacing. With `blurPx` 0.6 the box blur and the 6-unit `gridRedMargin` leave the 1 mm lines about a tenth as strong as the 5 mm lines in the projection profile, so their autocorrelation peaks sit near 0.08 and failed the old `r[L] > 0.08` sub-peak test. Fix (`lib/kymora/pipeline.ts`, `gridPeriod`): the first clear peak is treated as the 5 mm repeat when prominent peaks sit at 1/5 and at least two more of 2/5, 3/5, 4/5 of its lag; no absolute height test. `strength` is now `r[first]` in both cases, so a correctly calibrated strip is no longer scored lower than one read at the 5 mm spacing (the old code returned the weak 1 mm peak height, which would have pushed a correctly calibrated strip under the quality gate). No `CONFIG` value changed. `blurred-75-motion` (3.5 px blur, two 9 px box passes) has no 1 mm ladder left, so it keeps its old path and should stay refused at 0.44. Expect the synthetic bench rejection rate (91.7% in the last proof) to drop; that number is rewritten by the proof, not by hand.
- `scripts/reset.ts`: the featured check now prints "expected accepted, got refused (quality, grid, reasons)" when it fails, instead of the misleading "accepted, no bpm".
- **data: "Sample data: seeded synthetic strips. The held-out PTB-XL results are not shown in this build."** on `/digitize/*` and `/how`. That string no longer exists anywhere in the source: round 1 (`f8218b6`) replaced it with the scoped `SourceNote`. The crawl and screenshots show a deploy older than that commit. No code change; the redeploy of this tree serves "Seeded synthetic strip: ..." on strip pages and the calm held-out sentence on `/how`. The `/how` sentence stays, because the held-out table genuinely is not in this build (see below). If the next crawl still shows the old string, the deploy is stale, not the code.

## QA fix pass, round 3 (2026-11-24)

Written without running anything (npm and tsx need approval this session); the runner's `npm test` and `npm run proof` are the verification.

- **proof demo-reset FAILED** ("FAIL sinus-72-tilted: expected accepted, got refused (quality 0.89, grid 39.98 px/mm): Only 2.0 s of trace"). Round 2's ladder test was right in structure but kept a `r[L] > 0` filter on the rungs. Worked through the synthetic renderer by hand (minor line about 4 units over the 6-unit margin after the blur, major about 30): the profile mean is pulled up by the 5 mm pulses, so in the mean-subtracted autocorrelation every lag outside a major overlap sits on a negative floor, and the 1 mm rungs rise about 0.3 above it yet land near or below zero. They are clear local peaks (localPeaks already demands a 0.04 rise) that the sign test threw away. Fix: the sign test is gone (`lib/kymora/pipeline.ts`, `gridPeriod`); no `CONFIG` value changed. New `tests/grid.test.ts` builds exactly that profile (r at the 1 mm lag about -0.05) and a clean 6 px/mm one. `blurred-75-motion` has no ladder after its two 9 px box passes, so it should stay refused at 0.44.
- **data: "Sample data: seeded synthetic strips. The held-out PTB-XL results are not shown in this build."** on `/digitize/*` and `/how`. Still a stale deploy: the string exists nowhere in `app/`, `components/` or `lib/`, and the local `.next` build from 14:17 (BUILD_ID `gA8Blz5Tvas2CJ3L8hvmm`) serves "Seeded synthetic strip: ..." on `sinus-72-tilted` and the calm held-out sentence on `/how` (0 hits for the old string in either HTML file). The crawled page also shows "Tilt 3.0°", which predates round 1's fine skew pass. If the next crawl shows it again, check that Vercel is actually deploying `main` (project `kymora`), not the code.

## QA fix pass, round 4 (2026-11-24)

Written without running anything (curl, WebFetch and git remote all need approval this session).

- **proof tests, proof demo-reset**: both ok (23/23 tests, 6 checks 0 failed). Round 3's `gridPeriod` fix holds; nothing to do.
- **data: "Sample data: seeded synthetic strips. The held-out PTB-XL results are not shown in this build."** on `/how`, `/digitize/sinus-72-tilted`, `/digitize/brady-48-scan`, `/digitize/tachy-128-ward`. This is the fourth crawl with this finding, and production is still not serving the current tree. Evidence from the round 4 `/how` screenshot: the Tilt row reads "in 0.25° steps ... a parabola through the best three angles refines it", and the card reads "The held-out PTB-XL table is not shown in this build". None of those strings exist in `app/`, `components/` or `lib/` (grep, 0 hits). The current Tilt row names the 0.02° fine pass (`app/how/page.tsx:27`), and `components/source-note.tsx` has no "Sample data" branch at all. The served HTML predates `f8218b6`, while the proof run on this tree passes. No code change can fix this; see "QA: external findings".
- New, so the next crawl can settle it: every page now carries `<meta name="kymora-build" content="<commit7> <build ISO time>">` (`next.config.ts` sets `NEXT_PUBLIC_KYMORA_BUILD` at build time, `app/layout.tsx` renders it through `metadata.other`). If the crawled page shows an old commit, or no tag at all, production is pinned to an old deployment.

## QA: external findings

- **Production alias stuck on a pre-`f8218b6` deployment (rounds 1 to 4).** The crawl of https://kymora-eight.vercel.app serves copy that was removed four commits ago (see round 4 above), although the runner reports successful deploys and proof passes on this tree. Likely causes, in order: (1) an Instant Rollback was done on the Vercel project `kymora` (`prj_GYM1RklPYOSR5xCbLtkW8aIj3zPx`). After a rollback, Vercel stops auto-assigning production domains to new deployments until someone promotes one (`vercel promote <url>` or "Undo rollback" in the dashboard). (2) The runner deploys previews (`vercel deploy` without `--prod`), and only the preview URL is checked through `__farm.txt`. (3) Vercel builds fail and the alias keeps the last good build (check the Deployments tab). To confirm, view source on `/how` and look for `kymora-build`. Not fixed from the repo; the copy that replaces the notice is already committed and calm.

- Held-out PTB-XL table: `eval/ptbxl-results.json` does not exist in the repo and the deploy runs `ADAPTER_MODE=fake`. Producing it needs Python, `wfdb` and a local PTB-XL copy (`scripts/ptbxl/make_set.py`, then `npm run eval -- --set ptbxl`), which this agent cannot run. Not fixed; `/how` states it calmly. Once the file is committed and `ADAPTER_MODE=real` is set on Vercel, the held-out panel replaces the note with no code change.

## Phase 5: frontend pass, scene and submission package (2026-11-24)

**Goal.** Make the live URL read as a finished product in its first 10 seconds (clean L1 poster, a pinned scene with real numbers, shadcn-only controls, six scene slots) and ship a Devpost package that can be pasted as is.

**Status.** All four slices are written. The agent built, ran and tested nothing, because it cannot run commands. All ten BEFORE screenshots opened. They show the Phase 3 headline ("Paper ECG, read to the millisecond.") and a footer without the repo link, so the live deploy predates the Phase 4 commit; the diagnosis in `.farm-delta.md` only lists defects still present in the source.

**Decisions**
- Hero: `components/landing-intro.tsx` now renders the whole L1 hero section (sun disc, horizon line, headline, children) plus a `frame` prop, so the intro timeline and the new scroll-linked headline share one `useGSAP` scope. The hero is `min-h-[calc(100svh-4rem)]` with the content centred, so the CTA stays in the first viewport and the scene-1 band sits just below the fold. The sun disc moved from behind the words to the horizon line at the bottom right, `md:` and up only.
- Scroll-linked headline: Spectral ships as static 400/600/700 files, so a weight tween is not possible without a variable font (a new dependency). The headline scales to 92% from its bottom-left corner while the hero scrolls out (scrubbed, `transform` only, so the CTA never moves).
- Pinned scene (`components/strip-scene.tsx`): pins only from 768 px up and for 900 px (was 1600 px on every width, which left a blank screen in the full-page shots and a whole blank phone screen). Phones get the same scrubbed timeline without a pin. The rate counter now tweens from the uncalibrated baseline's bpm on the same image to Kymora's bpm, both pipeline outputs; it never starts at 0. Stage labels stay at full opacity and an oxblood underline marks progress. The figure gets the M3 `kymora-enter` keyframe when it scrolls into view. On phones the drawing keeps a 40rem width inside a keyboard-focusable scroll box.
- Scene strip choice (`app/page.tsx`): the featured strip if Kymora accepts it with a rate, else the most tilted accepted strip with a rate, each `runStrip` in try/catch so a pipeline throw cannot break the static build. The old code accepted a strip with a null rate and printed `?? 0`, which is where "Measured 0 bpm" came from.
- Simplification: "What it will not do" is three strata bands with one sentence each; the twelve-strip list folds behind a one-line `<details>` without pill tags; the `/how` "Reproduce it" card folds into a `<details>`. The "Who benefits" and "Who could be harmed" cards on `/how` stay because DEMO step 5 names them.
- Footer: one sentence plus Workspace, Method, Source on GitHub, the AI for Medicine hackathon page and SECURITY.md.
- shadcn discipline: the mobile Menu disclosure and the FigureTween toggle now use `Button` (`variant` follows the pressed state, `aria-pressed` kept, keyboard path is the native button). `Input` got `min-h-11`. `CardFooter` lost its `/40` tint.
- `scripts/proof.mjs` now also rewrites the `eval-synthetic` and `eval-ptbxl` blocks in `SUBMISSION.md`, so the Devpost text cannot drift from the README. No new measured number.
- README: two-sentence top, live URL with the step to click, "Try it in 60 seconds", a mermaid diagram of the real modules, quickstart cut to 5 commands, an addresses table with the live URL row only, the hackathon AI policy quoted, and a sentence under the demo-reset proof explaining the open "accepted, no bpm" failure. The PROOF block itself is untouched.
- No LICENSE file exists at the repo root. Choosing a license is the team's call, so the README says that no license file is committed yet, and adding one is in the manual checklist.
- IDENTITY.md is unchanged; no amendment was needed. No new dependency, env variable, route or schema change.

**Signature interactions (file, seed source)**
1. Pinned scroll scene: `components/strip-scene.tsx`, numbers from `runStrip()` (`lib/kymora/bench.ts`) on the seeded strips in `lib/data/seed.ts`, computed in `app/page.tsx` at build time.
2. Intro timeline and scroll-linked headline: `components/landing-intro.tsx`, text from the headline constant in `app/page.tsx`.
3. Figure tween bound to a control: `FigureTween` in `components/held-out-panel.tsx`, numbers from `eval/ptbxl-results.json` (zod-checked) or the bench summary in `components/bench-panel.tsx`.

**Scene slots (slot, route, file, source)**
- scene-1: `/`, `app/page.tsx` hero horizon band, 1600x280, SVG fallback `public/illustrations/scene-1.svg`.
- scene-2: `/`, `app/page.tsx` problem section, 960x640, SVG fallback `public/illustrations/scene-2.svg`.
- scene-3: `/how`, `app/how/page.tsx`, 960x640, SVG fallback `public/illustrations/scene-3.svg`.
- scene-4: `/digitize/[id]`, `app/digitize/[id]/page.tsx`, 800x720 (near square), SVG fallback `public/illustrations/scene-4.svg` (new).
- scene-5: `/digitize`, the empty state in `components/workspace.tsx`, 960x400, SVG fallback `public/illustrations/scene-5.svg` (new).
- scene-6: `/`, `app/page.tsx` closing band, 1600x240, SVG fallback `public/illustrations/scene-6.svg` (new).
- All six render the SVG fallback, because `public/brand/` has no rasters. Uploading `public/brand/scene-N.png` switches a slot automatically. No raster logo exists either, so no Marka rerun note applies.

**Routes (route, file, linked from)**
- `/`: `app/page.tsx`, brand link in the header.
- `/digitize`: `app/digitize/page.tsx`, header CTA (with `?strip=sinus-72-tilted`), mobile menu, footer.
- `/digitize/[id]`: `app/digitize/[id]/page.tsx`, header "Example result", landing strip list.
- `/how`: `app/how/page.tsx`, header "Method & evaluation", landing text link, footer.
- Header: two links plus the CTA from md up; three links plus the CTA in the mobile panel. One brand mark through `<BrandMark />` (`components/site-header.tsx:28-31`).

**Failed attempts.** None.

**Files changed**
- New: `SUBMISSION.md`, `public/illustrations/scene-4.svg`, `scene-5.svg`, `scene-6.svg`, `.farm-delta.md`, `.farm-commits.json`.
- Edited: `app/page.tsx`, `app/layout.tsx`, `app/how/page.tsx`, `app/digitize/[id]/page.tsx`, `components/landing-intro.tsx`, `components/strip-scene.tsx`, `components/held-out-panel.tsx`, `components/mobile-nav.tsx`, `components/workspace.tsx`, `components/ui/input.tsx`, `components/ui/card.tsx`, `scripts/proof.mjs`, `README.md`, `HANDOFF.md`.
- Untouched: `public/__farm.txt`, `app/icon.svg`, `public/logo.svg`, `public/illustrations/scene-1..3.svg`, `scripts/ptbxl/*`, `lib/kymora/*` (including `CONFIG`), `eval/*.json`, `package.json`, `.env.example`, `.gitignore` (already covers `.env*` with `!.env.example`), `.farm-live.json`, `IDENTITY.md`, `app/globals.css` (tokens already equal IDENTITY; the one `kymora-scale-in` keyframe and its reduced-motion block already existed), the Phase 4 wallet-hygiene decisions (no wallet code exists).

**Commands run.** None, the agent cannot run commands.

**Unmet or unverified items**
- `npm run build`, `npm test`, `npm run proof`, Lighthouse, the 360/768/1280 px check and the reduced-motion check are unverified.
- `git diff --stat` will not include `app/globals.css`, which the runner's check expects: the tokens and the M3 keyframe were already correct, and no edit was needed.
- GSAP typing: `mm.add(query, fn, scope)` passes an element as the scope (`components/strip-scene.tsx`, `components/landing-intro.tsx`). If the build rejects the third argument, delete it; the `useGSAP` scope still applies.
- scene-5 lives in the workspace empty state, which only shows when no strip is loaded. The workspace always preloads a strip, so judges will rarely see it.
- Not every `/how` section is one sentence plus a visual: the six pipeline steps keep a paragraph each (judges may ask what a function does), and the benefit and harm cards stay for DEMO step 5.
- The featured strip may still have no rate (README demo-reset proof). The landing scene then shows another seeded strip, and DEMO steps 2 and 3 on the featured strip stay as flaky as before. Per the cut protocol this is not fixed here.
- `docs/SCREENSHOTS.md` was not created; no screenshot wish list was needed.
- No LICENSE file (see Decisions).
- The only double hyphens in README.md and SUBMISSION.md are CLI separators (`npm run eval -- --seed 42`) and table rules inside the PROOF blocks.

**Open questions**
- Which license should the repo carry?
- Should the featured demo strip change to one that reliably reports a rate, now that the landing scene picks its own? That touches `lib/data.ts` and DEMO.md, so it was left alone.

**Next best step (Phase 6, judge-round fixes).** Redeploy and compare against the BEFORE shots defect by defect, scroll the pinned scene with reduced motion on and off at 390 and 1440 px, then look into the "accepted, no bpm" failure on the featured strip (on synthetic data only, never fold 10).

## Phase 4: judge surface, second wow, polish and security pass (2026-11-24)

**Goal.** Make the live URL work on a phone and on desktop, add signature 3 (a figure tween on `/how`) and signature 2 (the landing intro), write the prize table, DELIVERY.md and SECURITY.md, and sweep for web security issues.

**Status.** All five slices are written. The agent built, ran and tested nothing because it cannot run commands. `npm run build`, `npm test`, the 360/768/1280 px check, Lighthouse and the reduced-motion check are all the runner's or the human's job.

**Decisions**
- Prize table: no `sponsor-bounty` rows exist in `targetTracks` (four organizer categories, all `entryMode: automatic`, `requiredTech: []`). No integration and no cost was dropped. The seat rule is not triggered, and no two bounties share an architectural seat.
- Slots: the record gives 1 slot for the Grand Prize only. The other three rows say "not stated" instead of an invented number.
- DEMO step column after the renumber: Grand Prize 2 to 6, Research 5 and 6, Presentation 2 to 7, Logo 1 and 7.
- Contract front skipped, no `contracts/` directory and no chain in this project.
- Wallet front: grep over `app/`, `components/`, `lib/` for `eth_requestAccounts|eth_sign|personal_sign|window\.ethereum|approve\(|connect\(` returned 0 matches. The wallet-hygiene rules verify vacuously. No Blockaid warning is expected, because there is no wallet code.
- Mobile nav: `components/mobile-nav.tsx` (client) renders a `md:hidden` "Menu" button with `aria-expanded` and `aria-controls="kymora-mobile-nav"`, and a solid ground panel (`absolute inset-x-0 top-full border-b border-border bg-background`) listing `/digitize`, `/digitize/<featured>`, `/how` and the CTA. It closes on `usePathname` change and on Escape. The desktop switch moved from `sm:` to `md:` (`components/nav-links.tsx:25`, `components/site-header.tsx:34`). The header still shows two links plus the CTA from md up, and three links plus the CTA in the panel. One brand mark (`components/site-header.tsx:29`).
- Touch targets: the shared `Button` sizes are now `min-h-11` (sm and default), `min-h-12` (lg) and `size-11` (icon) (`components/ui/button.tsx:21-26`), which covers strip buttons, CSV, copy link, retry and the bench buttons. Nav links, the brand link, footer links, the landing text link and the result-page breadcrumb got `min-h-11` or `py-3`.
- Signature 3 lives in `components/held-out-panel.tsx` as the exported `FigureTween`, so the file that the gate names holds the `useGSAP` call, the matchMedia `reduce` branch and the toggle. `HeldOutPanel` became a client component for that. `components/bench-panel.tsx` renders the same `FigureTween` in its done state as the fallback when the held-out file is absent. GSAP tweens one plain proxy object and paints the figures and bars from it. Values come only from `results.rows[0..1]` plus `results.histogram` (zod-checked) or the bench summary that just ran. A null MAE reads "n/a". Bars share one scale across both methods. The static table and the two small-multiple histograms stay.
- Signature 2: `components/landing-intro.tsx` splits the headline into word spans by hand and runs a timeline (words stagger, then the `data-intro-frame` scene band scales from 0.96). It uses `gsap.from` after hydration only, under `(prefers-reduced-motion: no-preference)`, with `clearProps`. The server HTML is the final visible state. The h1 lost its CSS `kymora-enter` so the two animations do not overlap.
- Landing copy: new headline "Paper ECG strips, measured in your browser." (the old "millisecond." was about as wide as a 360 px screen at 3.5rem). The hero paragraph pulls its numbers from `CONFIG` (`maxSkewDeg`, `fs`, `qualityThreshold`) and was kept short so the CTA stays in the first viewport on a phone.
- Metadata: `metadataBase` now points at `https://kymora-eight.vercel.app`, the live URL in README.md, because the og:image URL resolves against it. It used to say `kymora.vercel.app`. See Open questions.
- `app/digitize/[id]/page.tsx:48` used `console.log` (the spec assumed `console.error`), and it is now `console.error`. The `console.log` lines in `lib/` (adapter fallback, held-out and lookup status) are server-only `[core]` logs outside the grep scope and stay.
- Footer: repo link and a SECURITY.md link, both `target="_blank" rel="noopener noreferrer"`, with no new route (`app/layout.tsx:70-83`).

**Responsive audit (before the fixes)**
- `components/result-view.tsx`: canvas and overlay are already `w-full h-auto` in an `overflow-hidden` figure. The figures grid is `md:grid-cols-3` (one column below md). Buttons were 32 to 36 px tall, now 44 px. The footer wraps.
- `components/workspace.tsx`: strip buttons were `size="sm"` (32 px), now 44 px. The drop label is `p-5`, well over 44 px. A dropped file name in the result h2 could overflow, so it now has `break-all` plus `title`.
- `components/local-result.tsx`: the stored label h2 got the same `break-all` plus `title`.
- `components/bench-panel.tsx` and `components/held-out-panel.tsx`: both tables were already in `overflow-x-auto` (`min-w-[36rem]` with `w-full`). The histograms are `w-full max-w-full`. "Run again (same seed, same numbers)" can now wrap.
- `components/states.tsx`: error and empty messages got `break-words`, because they can contain a long file name.
- `app/page.tsx`: the sun disc `sm:size-[30rem]` is decorative inside `overflow-hidden`, and it got `max-w-full`. The headline is covered above. The landing has no other fixed width over 360 px.
- `app/not-found.tsx`, `app/error.tsx` and the three route `error.tsx` files render inside `app/layout.tsx`. There is no `global-error.tsx`, so the header, the mobile nav and the footer stay. No change needed.

**Security and hygiene greps (over `app/`, `components/`, `lib/`)**
- `sk-|PRIVATE_KEY|[0-9a-fA-F]{64}|[A-Za-z0-9+/]{120,}`: 0 matches. The only `NEXT_PUBLIC_` key is `NEXT_PUBLIC_BRAND_FILES` (public image names).
- `target="_blank"`: 2 matches, both in `app/layout.tsx`, both with `rel="noopener noreferrer"`.
- `http://`: only `app/icon.svg:1` (the SVG namespace, not a request).
- `<form`: 0 matches.
- `process.env`: `lib/config.ts:13` (`ADAPTER_MODE`) and `lib/brand-files.ts:2` (`NEXT_PUBLIC_BRAND_FILES`). Both are in `.env.example`. `.farm-live.json` stays `{ "requiredEnv": [], "optionalEnv": [] }`.
- `useSearchParams`: 0 matches. `/digitize` reads `searchParams` as a Promise in the server page (`app/digitize/page.tsx:10`).
- `writeFile|appendFile|createWriteStream|fs\.`: 0 matches. Reads: `readFileSync` in `lib/held-out.ts:26` (`eval/ptbxl-results.json`) and `lib/ptbxl-lookup.ts:29` (`eval/ptbxl-lookup.json`), both committed eval files.
- API routes: all three export only `GET`. None receives images.
- Found but not fixed: nothing.

**Sameness tripwire (over `app/`, `components/`)**
- Hex literals: only `app/globals.css` (the tokens), `app/opengraph-image.tsx:10` (documented mirror) and `app/icon.svg` (never-touch file, documented since Phase 1). There are no dead hexes.
- Keyframes: only `kymora-scale-in` (`app/globals.css:113`). Banned keyframes, `--delay`, `--d:` and `backdrop-blur`: 0 matches.
- Em and en dashes and banned words: 0 matches in `app/`, `components/`, README.md, DEMO.md and DELIVERY.md. The only HANDOFF matches are the banned-word lists themselves.
- The figure readout in `FigureTween` is a plain `dl` next to the chart in Spectral, with no tiles, no mono and no band. One brand mark in the header.

**Failed attempts.** None.

**Files changed**
- New: `DELIVERY.md`, `SECURITY.md`, `components/mobile-nav.tsx`, `components/landing-intro.tsx`.
- Edited: `README.md`, `DEMO.md`, `HANDOFF.md`, `components/site-header.tsx`, `components/nav-links.tsx`, `components/ui/button.tsx`, `components/held-out-panel.tsx`, `components/bench-panel.tsx`, `components/workspace.tsx`, `components/local-result.tsx`, `components/states.tsx`, `app/page.tsx`, `app/layout.tsx`, `app/opengraph-image.tsx`, `app/digitize/[id]/page.tsx`.
- Untouched: `app/icon.svg`, `lib/kymora/*` (including `CONFIG`), `eval/*.json`, `package.json`, `.env.example`, `.farm-live.json`, the `busyRef` and `fileKey` guards.

**Commands run.** None, the agent cannot run commands.

**Unmet or unverified items**
- `npm run build`, `npm test`, Lighthouse of 80 or more, the og:image absolute URL, and no horizontal scroll at 360/768/1280 px are all unverified.
- GSAP typing: `ctx.conditions?.reduce` and `ReturnType<typeof gsap.matchMedia>` follow the gsap 3.12+ types. If the build rejects either, `(ctx.conditions as Record<string, boolean> | undefined)?.reduce` is the shortest fix.
- The `README.md` demo-reset proof block still shows "FAIL sinus-72-tilted: accepted, no bpm". That is the Phase 3 output, and pipeline accuracy is out of scope for this phase. The landing scene falls back to the next accepted strip, or to its `EmptyState`.
- The `aria-pressed:` Tailwind variant styles the active toggle. If it does not apply, the toggle still works and only the pressed fill is missing.

**Open questions**
- Which host is live: `kymora-eight.vercel.app` (README) or `kymora.vercel.app` (HANDOFF definition of done)? `metadataBase` now uses the README host. If the deploy is the other one, change `app/layout.tsx:29`.
- Slot counts for the three non-Grand categories are not in the record.

**Next best step.** Phase 5, the frontend pass. Before that, the human walks DEMO steps 1 to 7 on the live URL at 360, 768 and 1280 px with reduced motion on and off, works through the "Before submitting" list in DELIVERY.md, and finishes the Phase 2 checklist plus `npm run lookup`.

## Phase 3: demo path states, guards and reset (2026-11-24)

**Goal.** Make the whole DEMO.md path safe around the Phase 2 held-out mechanism: a PTB-XL reference for dropped photos named after their ecg_id, loading, error-with-retry and empty states on every demo route, guards against double drops, and a `demo:reset` determinism check.

**Status.** All six slices are written. Nothing was built, run or tested by the agent, which cannot run commands. Until the human completes the Phase 2 checklist plus `npm run lookup`, `/digitize` shows no PTB-XL reference for dropped photos. That is the intended fallback, not a bug.

**Step to file map (each with its fallback in the same file)**
- Step 1: `app/page.tsx`. Fallback: `EmptyState` with "Open the workspace" when no seeded strip passes the gate (`app/page.tsx:113`).
- Steps 2 and 3: `components/workspace.tsx`. Lookup fallback: `getReferenceLookup()` returns null in `lib/adapter-fake.ts` and when the file is missing in `lib/adapter-real.ts` (via `lib/ptbxl-lookup.ts`); the selector in `lib/adapter.ts` falls back to fake. No match means no reference and no invented number.
- Step 4: `components/workspace.tsx` (refusal renders through `ResultView`; pipeline throw goes to `ErrorState` with retry).
- Step 5: `app/how/page.tsx`, with the held-out `EmptyState` ("Try it on a strip") and `components/bench-panel.tsx` (idle `EmptyState` "Run the bench", running skeleton with a disabled button, `ErrorState` with retry).
- Step 6: `app/digitize/[id]/page.tsx` (getRun throw logged as `[core] run failed id=<id>` and rethrown to `app/digitize/[id]/error.tsx`), with `components/local-result.tsx` for `local-` ids.

**Route to state file map**
| Route | Loading (Skeleton) | Error (ErrorState with retry) | Empty (EmptyState with CTA) |
| --- | --- | --- | --- |
| `/` | none (static, prerendered; no `app/loading.tsx` added, see Decisions) | `app/error.tsx` | `app/page.tsx` scene fallback |
| `/digitize` | `app/digitize/loading.tsx` (PageSkeleton), `WorkspaceSkeleton` in `components/workspace.tsx` | `app/digitize/error.tsx`, `ErrorState` in `components/workspace.tsx` | `EmptyState` in `components/workspace.tsx` ("Run the example strip") |
| `/digitize/[id]` | `app/digitize/[id]/loading.tsx`, `WorkspaceSkeleton` in `components/local-result.tsx` | `app/digitize/[id]/error.tsx`, `ErrorState` in `components/local-result.tsx` | `EmptyState` in `components/local-result.tsx` ("Open the workspace"); unknown seeded ids keep `notFound()` |
| `/how` | `app/how/loading.tsx`, `Skeleton` in `components/bench-panel.tsx` | `app/how/error.tsx`, `ErrorState` in `components/bench-panel.tsx` | `EmptyState` in `app/how/page.tsx` and `components/bench-panel.tsx` |

**Decisions**
- Persistence, chosen row: "Steps only read seeded or computed data: none, seed constants and in-memory per request". Rejected: KV, because no mutable shared state exists and photos never leave the device. Postgres, because there are no relational reads. On-chain, because there is no chain. The only per-visitor state is the `sessionStorage` keys `kymora:<id>` written in `components/workspace.tsx` and read in `components/local-result.tsx`. This is the deliberate "no server persistence" design. `lib/store.ts` was not created and no store driver is imported anywhere.
- Idempotency: client side only. `busyRef` in `components/workspace.tsx` makes `runSeed` and `runFile` return early during a run and is cleared in `finally`. The strip buttons, the file input and the drop label are bound to `state.kind === "working"` (`disabled`, `aria-disabled`, `pointer-events-none`). `fileKey(file)` (name, size, lastModified, in `lib/file-key.ts`, re-exported from the workspace) maps to the `local-` id already created, so a re-drop reuses the id and writes no second entry. Server side idempotency is not applicable: there are no server writes.
- Drag handlers moved from the label to a wrapper `div`, so a drop during a run (label has `pointer-events-none`) is still caught and ignored instead of the browser opening the file.
- Storage quota: `storeLocal` tries with the photo, then without it, then gives up. On a full storage the result still reaches `done`, without `resultPath` (ResultView hides the copy and open links when it is absent) and with a "Result link unavailable" line.
- `ecgIdFromFilename` lives in `lib/ecg-id.ts` (no `node:` imports) so the client workspace can import it; `lib/ptbxl-lookup.ts` re-exports it next to `loadPtbxlLookup`. Same for `fileKey` in `lib/file-key.ts`, so the test imports it without a DOM.
- `loadPtbxlLookup` returns `{ lookup, reason }`. `lib/held-out.ts` gained `loadHeldOutStatus()` with the same shape so `demo:reset` can print the reason code; `loadHeldOutResults()` is unchanged for its callers.
- `ResultView` had no slot for the reference source, so it gained an optional `referenceLabel` prop shown under the reference ("PTB-XL fold 10 reference, ecg_id N"). Seeded strips do not pass it.
- `LocalResult` validates the stored entry with `storedLocalResultSchema` (zod, `lib/schemas.ts`). Errors carry an `ErrorCode`: blocked storage `not_configured`, bad JSON `parse_failure`, wrong shape `invalid_input`.
- Tracing include: `outputFileTracingIncludes` is a top-level `NextConfig` key in the installed Next 15.5.29 (`node_modules/next/dist/server/config-shared.d.ts:1125`). Added for `/digitize` with both `./eval/ptbxl-lookup.json` and `./eval/ptbxl-results.json`, because the real adapter is only selected when the results file is also readable at request time.
- `SceneSlot` and `BrandMark` used raw `<img>`, not `next/image` as the spec assumed. Both now use `next/image`. SVG sources are served unoptimized by the default loader; an uploaded PNG is resized.
- No `app/loading.tsx` for `/`: the page runs the pipeline only at build time (static prerender), so a loading boundary would never show.
- `demo:reset` compares measurement JSON without `runtimeMs`, the one clock dependent field.
- `proof.mjs` extended cleanly: new `demo-reset` README block with the check lines.
- Web3 wallet state machine: not applicable. The repo has no wallet, no `contracts/` directory and no chain dependency.

**Failed attempts.** None.

**Files changed**
- New: `lib/ptbxl-lookup.ts`, `lib/ecg-id.ts`, `lib/file-key.ts`, `scripts/ptbxl-lookup.ts`, `scripts/reset.ts`, `components/states.tsx`, `app/digitize/error.tsx`, `app/digitize/[id]/error.tsx`, `app/how/error.tsx`, `tests/ptbxl-lookup.test.ts`.
- Edited: `lib/schemas.ts`, `lib/config.ts`, `lib/types.ts`, `lib/adapter-fake.ts`, `lib/adapter-real.ts`, `lib/held-out.ts`, `components/workspace.tsx`, `components/result-view.tsx`, `components/local-result.tsx`, `components/bench-panel.tsx`, `components/scene-slot.tsx`, `components/brand-mark.tsx`, `app/error.tsx`, `app/page.tsx`, `app/digitize/page.tsx`, `app/digitize/[id]/page.tsx`, `app/how/page.tsx`, `next.config.ts`, `package.json`, `scripts/proof.mjs`, `README.md`, `CLAUDE.md`, `HANDOFF.md`.
- Not created: `eval/ptbxl-lookup.json` (needs the manifest; no invented values), `lib/store.ts`.
- Unchanged: `.env.example`, `.farm-live.json`, `app/icon.svg`, `public/logo.svg`, `components/ui/*`, `lib/kymora/*`.

**Commands run.** None, the agent cannot run commands.

**Acceptance gate, checked by reading files**
- `getReferenceLookup` is on the interface (`lib/adapter-fake.ts`), in `fakeAdapter` and in `makeRealAdapter`. `app/digitize/page.tsx` passes `lookup`; `components/workspace.tsx` calls `ecgIdFromFilename`.
- Grep for `writeFile|appendFile|mkdirSync|createWriteStream` over `app/`, `components/`, `lib/`: 0 hits. Writes exist only in `scripts/ptbxl-lookup.ts`, `scripts/eval.ts` and `scripts/proof.mjs`.
- No new env variable and no `NEXT_PUBLIC_` key.
- Sameness greps over `app/`, `components/`, `lib/`: dead hexes, banned keyframes, `--delay`, `--d:`, `backdrop-blur`: 0 hits. Raw hex: only the documented `app/opengraph-image.tsx:10`. Em and en dashes and banned words: 0 hits (also over `scripts/`, `tests/`, README). Double hyphen: only the CLI separator in code (`npm run eval -- --set ptbxl`) and the README table rule. No new keyframe; `components/states.tsx` uses `kymora-enter` only. Header untouched, one brand mark.
- Stack claims: no new library; `next/image` ships with `next`.

**Unmet or unverified items**
- `npm run build`, `npm test`, `npm run demo:reset` (three identical runs), `npm run lookup` and `npm run proof` are unverified until the runner runs them.
- `demo:reset` asserts that `blurred-75-motion` is refused with quality under `CONFIG.qualityThreshold`. DEMO step 4 implies this, but if that strip is refused for another reason (for example too few beats) while its quality is above 0.60, the check fails and exits 1. Then the fix is to the check's wording, never to `CONFIG`.
- The PTB-XL reference only shows in real mode, which itself needs a valid `eval/ptbxl-results.json`. A lookup committed without the results file stays invisible.
- `next/image` for an SVG source relies on the default loader skipping SVG optimization; check the landing and `/how` illustrations after the build.

**Open questions**
- Should fake mode also serve the lookup when the file exists? The spec says no (fake returns null), so a PTB-XL photo shows its reference only with `ADAPTER_MODE=real`.

**Next best step (Phase 4).** Landing polish and GSAP signatures 2 (intro timeline on the hand-split headline) and 3 (figure tween bound to a control on `/how`). Before that, the human runs the Phase 2 checklist, then `npm run lookup`, commits `eval/ptbxl-lookup.json`, and checks a `<ecg_id>.png` drop on the live URL.

## Phase 2: held-out PTB-XL evaluation goes real (2026-11-24)

**Goal.** DEMO step 5 (`/how`) shows the held-out table (Kymora, baseline, baseline on accepted) for PTB-XL fold 10 images, seed 42, read through zod from a committed `eval/ptbxl-results.json`, next to the live synthetic bench, which stays.

**Status.** All five slices are written. Nothing was built, run or tested by the agent, which cannot run commands. The runner owns `npm install`, `npm run build`, `npm test` and `npm run proof`. The held-out set itself does not exist yet: it needs the human run below. Until then `/how` shows the honest "not shown in this build" sentence, and `eval-ptbxl` in the README reads "Not run in this build".

**Mechanism that went real.** The held-out PTB-XL results: `scripts/ptbxl/make_set.py` builds the set, `npm run eval -- --set ptbxl` scores it with the in-repo pipeline and writes `eval/ptbxl-results.json`, `lib/held-out.ts` validates it, and `lib/adapter-real.ts` serves it through `getHeldOut()`.
**Still on fixtures (synthetic, in both modes):** `listStrips`, `listSummaries`, `getStrip`, `getRun`, `getResult`, `getBench`, `getBenchConfig`. The real adapter delegates them to the fake implementations, and every strip item keeps `synthetic: true`.
**Env list:** `.farm-live.json` has `requiredEnv: []` and `optionalEnv: []`. The real path is in-browser signal processing over committed result files and needs no secret. `ADAPTER_MODE` is a plain non-secret switch that is already documented in `.env.example`.

### Manual checklist for the human (in order)

1. Download PTB-XL from PhysioNet (about 2 GB of disk; Python 3 needed; no account funds or testnet involved). If you want the default renderer, also clone ECG-Image-Kit and install its own requirements.
2. Run `pip install -r scripts/ptbxl/requirements.txt`, then `python scripts/ptbxl/make_set.py --ptbxl-root <path> --renderer ecgkit --ecgkit-dir <clone>`. If ECG-Image-Kit fails, use `--renderer matplotlib`. Open three images in `data/ptbxl-fold10/images/` and check that `traceStartS` in `manifest.json` matches where the trace starts at the image's left edge. For ECG-Image-Kit, also check the rhythm strip crop (`ecgkit.rhythmStripCrop`, `ecgkit.traceStartS` in `scripts/ptbxl/render-config.json`).
3. Run `npm run eval -- --set ptbxl`. It prints the table, `CONFIG`, renderer, seed and n, and writes `eval/ptbxl-results.json`.
4. Commit `data/ptbxl-fold10/manifest.json`, `data/ptbxl-fold10/reference/` and `eval/ptbxl-results.json`. The images stay gitignored. Set `ADAPTER_MODE=real` on Vercel, redeploy, open `/how`, then run `npm run proof` so the README shows the committed rows.
5. Check the PTB-XL and ECG-Image-Kit licenses on their pages before publishing derived images or reference waveforms.

**Decisions**
- `lib/config.ts` has no timeout or retry constants because Kymora makes no outbound calls.
- `readAdapterMode()` reads `process.env` at call time; `ADAPTER_MODE` is also exported as the value at module load. The selector uses the function so tests can change the env in one process.
- `lib/adapter.ts` exports a pure `selectAdapter(mode, heldOut)` for tests, plus `getAdapter`, `adapterMode`, `KymoraAdapter` and `fakeAdapter` as before. `adapterMode()` now returns the mode that actually answers after the fallback. The fallback is logged once per process: `[core] adapter fake reason=not_configured`.
- `loadHeldOutResults(path?)` caches per path, and the reason codes are `not_configured` (missing file), `parse_failure` (bad JSON) and `invalid_input` (schema mismatch). Tests pass a path that does not exist, so they keep passing after the human commits the real file.
- Time alignment: the spec asked to shift the reference by `traceStartS`. `snrDb` indexes the reference waveform by time and must not change, so `evaluateRaster` applies the equivalent shift to each estimate (`rPeaksMs` and `signal.t0` minus `traceStartS`), identically for Kymora and the baseline (`lib/kymora/bench.ts:139-164`).
- `bench.ts` is not strictly additive. `rrMae`, `ScoredCase` and `evaluateRaster` are additions. To let `summarize` take held-out cases that have no `StripParams`, `CaseResult` now extends `ScoredCase` (same shape), and `summarize`, `row` and `BenchSummary` became generic over `ScoredCase` with `CaseResult` as the default. `formatTable` gained an optional title so the PTB-XL table is not headed "synthetic bench". These are type-level changes only: every synthetic call site and every runtime result is unchanged.
- `SourceNote` takes `mode` and `heldOut` (its `n`, `renderer` and `seed`) rather than a bare boolean, because the live sentence names N and the renderer.
- The `/digitize` note was cut. That page is dynamic (it reads `searchParams`), so on Vercel it resolves the adapter at request time, and the serverless bundle may not include `eval/ptbxl-results.json`. The note could then say "sample data" while `/how` says "live source". `/how` and `/digitize/[id]` are prerendered at build time, where the file is present.
- `/api/strips/[id]` returns `{ ok: false, error: "invalid_input", hint }` with status 400 for a bad id. `ApiResponse` gained an optional `hint`. The 404 and 500 bodies are unchanged.
- `scripts/eval.ts` now exits 1 on an unknown `--set` value instead of silently running the synthetic bench. `--set synthetic` and the default behave exactly as before.
- Both renderers get the same seeded degradations (tilt, blur, shadow, JPEG) from `render-config.json` after rendering. The per-record RNG is seeded with `[seed, ecg_id]`. Records with no lead II or fewer than 3 detected R peaks are skipped and listed in `manifest.skipped`, so n can be below 300.
- The proof script runs the 60 strip synthetic bench and the tests with `node_modules/.bin/tsx` through `execFileSync`, with a 90 s timeout each. It reads the PTB-XL results file with a light shape check, because it may only use `node:` modules.

**Failed attempts.** None. The ECG-Image-Kit invocation was never run, so it has not failed either. It is unverified (see Open questions).

**Files changed**
- New: `lib/config.ts`, `lib/errors.ts`, `lib/schemas.ts`, `lib/held-out.ts`, `lib/adapter-fake.ts`, `lib/adapter-real.ts`, `components/source-note.tsx`, `components/held-out-panel.tsx`, `scripts/ptbxl/make_set.py`, `scripts/ptbxl/render-config.json`, `scripts/ptbxl/requirements.txt`, `scripts/proof.mjs`, `tests/held-out.test.ts`, `tests/schemas.test.ts`, `tests/adapter.test.ts`, `.farm-live.json`.
- Edited: `lib/adapter.ts` (now the selector), `lib/types.ts`, `lib/kymora/bench.ts`, `scripts/eval.ts`, `app/how/page.tsx`, `app/digitize/[id]/page.tsx`, `app/api/strips/[id]/route.ts`, `package.json`, `.env.example`, `.gitignore`, `README.md`, `CLAUDE.md`, `DEMO.md`, `HANDOFF.md`, `.farm-commits.json`.

**Commands run.** None, the agent cannot run commands.

**Acceptance gate, checked by reading files**
- Same interface: `lib/adapter-real.ts:10` returns `KymoraAdapter` from `lib/adapter-fake.ts:13`. The only branch on mode is `lib/adapter.ts:25`, and it defaults to fake.
- No page or client component imports `adapter-real` or `held-out`. The only importers are `lib/adapter.ts:11` and `tests/adapter.test.ts:4`. None of the seven `"use client"` files imports `lib/adapter`, `lib/held-out` or `lib/config`.
- `.farm-live.json` holds both empty arrays, justified above.
- `lib/config.ts:13` reads only `ADAPTER_MODE`, and `.env.example` documents it with a comment.
- `package.json` has the `test` and `proof` scripts. README.md has three BEGIN/END pairs (`eval-synthetic`, `eval-ptbxl`, `tests`). `scripts/proof.mjs` writes "Not run in this build" on missing data and always ends with `process.exit(0)`.
- Placeholder grep on README.md and HANDOFF.md: zero hits after this edit.
- `components/source-note.tsx` is used on `app/how/page.tsx:98` and `app/digitize/[id]/page.tsx:62`.
- With fake mode, `/how` renders the "not shown in this build" sentence (`app/how/page.tsx:101-107`) and `BenchPanel`. No wow-path branch depends on real mode.
- `app/api/strips/[id]/route.ts:9` parses the id first. The tests import the schemas from `lib/schemas.ts`.
- `lib/errors.ts:5` defines the five codes, and `lib/errors.ts:7` defines `{ error, hint }`.
- There is no new `NEXT_PUBLIC_` key. Log lines print only codes, n and the renderer, never a payload.
- `scripts/eval.ts` no longer contains "not generated yet". `bench.ts` has a type-level widening (see Decisions).
- Imports: `zod`, `pngjs` and `@types/pngjs` are in `package.json`. The seeded strips and the build-time pipeline calls are untouched.

**Sameness tripwire (grep over `app/`, `components/`, `lib/`)**
- Dead hexes: 0 hits.
- Banned keyframes, `--delay`, `--d:`, `backdrop-blur`: 0 hits.
- Raw hex in a component: 0 hits, apart from the documented `app/opengraph-image.tsx:10`.
- Em and en dashes and banned words: 0 hits.
- Double hyphen: hits only inside code, as the CLI argument separator in `npm run eval -- --set ptbxl` (`app/how/page.tsx`, `components/held-out-panel.tsx`, `lib/held-out.ts`, `app/api/bench/route.ts`). None is a dash in prose.
- `components/site-header.tsx` is untouched, so the header still has one brand mark.

**Open questions**
- The ECG-Image-Kit flags in `scripts/ptbxl/render-config.json` (`gen_ecg_image_from_data.py -i <rec>.dat -hea <rec>.hea -o <dir> -se 42 -r 200 --full_mode II --num_columns 4`), the crop box `[0, 0.72, 1, 0.98]` and `traceStartS: 0` are unverified, because they were written from README conventions. If they cost more than 45 minutes, switch to `--renderer matplotlib`, say so in the README, and record it under Failed attempts.
- The wfdb calls (`xqrs_detect`, `correct_peaks(..., peak_dir="compare")`, `resample_sig`) match wfdb 4 but were not run.
- `.gitignore` has `.farm-*`, which also ignores `.farm-live.json` and `.farm-commits.json`. The runner presumably reads them from disk; if they must be committed, they need `git add -f`.
- Rotating around the image centre moves the trace start a little at the left edge. RR and HR are unaffected, but SNR could lose up to the ±60 ms lag window on strong tilts.
- `npm test`, `npm run build` and `npm run proof` are unverified until the runner runs them.

**Next best step (Phase 3).** The real photo check (print three fold 10 strips, photograph them tilted, record measured vs reference), the PTB-XL filename lookup in the workspace, persistence (none: keep the app stateless), and per-step loading polish. Never tune `CONFIG` on fold 10.

## Phase 1: walking skeleton and seams (2026-11-24)

**Goal.** Every step of the 90 s demo has a route, the demo path is clickable with seeded strips, and data flows through typed seams that Phase 2 can swap without touching pages.

**Status.** All five slices written. Not built or run by the agent (it cannot run commands); the runner owns `npm install`, `npm run build`, `npm run seed` and the first deploy.

**Decisions**
- `lib/adapter.ts` exposes `listStrips`, `getStrip`, `getResult`, `getBench` as asked, plus `listSummaries` (API list without render params), `getRun` (the full `StripRun` the result page needs for the canvas and overlay) and `getBenchConfig` (seed and size for the `/how` panel). `featuredStripId` and `mode` are properties.
- `ADAPTER_MODE=real` returns `fakeAdapter`, whose `mode` stays `"fake"`, so no API response claims real data before Phase 2.
- `/how` renders no seeded strip, so its seam is `getBenchConfig()` passed into `BenchPanel` as `seed` and `n` props, with the same values as `BENCH_DEFAULTS` (rendered output unchanged).
- `/api/strips` and `/api/bench` are `force-static` (computed at build; the bench adds about 40 strip runs to the build). `/api/strips/[id]` keeps the default dynamic behavior so unknown ids return a 404 JSON.
- `app/page.tsx` and `components/site-header.tsx` still import `@/lib/data` (only `FEATURED_STRIP_ID` and the strip list). They were out of this phase's scope; move them behind the adapter when Phase 2 changes the source.
- The landing page got `title: { absolute: ... }` so it keeps the brand line instead of the `%s | Kymora` template.
- Global `:focus-visible` outline sits in `@layer base` so the existing ring utilities on buttons and inputs still win.
- `components/result-view.tsx` canvas and SVG overlay scale with `w-full h-auto` inside an `overflow-hidden` figure, and the histogram SVG is `w-full`, so neither needed an `overflow-x-auto` wrapper. The bench table already had one.
- `app/icon.svg` holds raw hexes (all equal to IDENTITY values). It is on the never-edit list, so it stays as is, documented as an exception next to `app/opengraph-image.tsx`.
- One comment word in `lib/kymora/bench.ts` ("harness") was changed to "bench" for the banned-word list. No logic changed.

**Failed attempts.** None.

**Files changed**
- New: `DEMO.md`, `CLAUDE.md`, `lib/types.ts`, `lib/adapter.ts`, `lib/data/seed.ts`, `scripts/seed.ts`, `app/api/strips/route.ts`, `app/api/strips/[id]/route.ts`, `app/api/bench/route.ts`, `app/digitize/loading.tsx`, `app/digitize/[id]/loading.tsx`, `app/how/loading.tsx`, `components/page-skeleton.tsx`, `components/nav-links.tsx`, `.farm-commits.json`.
- Edited: `package.json` (seed script), `.env.example`, `app/digitize/page.tsx`, `app/digitize/[id]/page.tsx`, `app/how/page.tsx`, `components/bench-panel.tsx`, `components/workspace.tsx` (empty state, decode error copy, file input label, focus ring on the drop zone), `components/site-header.tsx`, `app/error.tsx`, `app/not-found.tsx`, `app/page.tsx` (metadata only), `app/globals.css` (focus-visible), `app/opengraph-image.tsx` (comment), `lib/kymora/bench.ts` (comment), `README.md`, `HANDOFF.md`.

**Commands run.** None, agent cannot run commands.

**Open questions**
- None needed a new dependency, route or env variable beyond `ADAPTER_MODE`, which the phase spec asked for.

**Next best step.** Phase 2: build the held-out PTB-XL fold 10 set, implement `loadPtbxlFold10()` in `scripts/eval.ts`, then add a real adapter in `lib/adapter.ts` behind `ADAPTER_MODE=real` that serves those results (and set its `mode` to `"real"`).

## 1. Context

**Product:** Kymora. It reads a phone photo of a printed lead II ECG rhythm strip in the browser, turns it into a millivolt and millisecond signal, measures heart rate and RR intervals, and refuses to answer when the photo cannot support a measurement.

**Pitch, plain:** You have an old paper ECG and want to send it to a doctor or a research file as data. Open the page and drop a photo of the strip. A few seconds later a green trace sits on top of the printed line, with heart rate and beat-to-beat intervals underneath, and you can download the file. If the photo is too blurred or tilted, the app says "no reliable measurement from this image" instead of guessing. The photo never leaves your browser.

**Hackathon:** AI for Medicine: A Global Student Hackathon on the Future of Care (Devpost, https://ai-for-medicine.devpost.com/). Students only, teams of 1 to 4.
**Deadline:** 4 December 2026, 23:45 EST.
**Target track:** Grand Prize. Also aiming at Excellence in Research & Reproducibility, Best Presentation and Best Logo. All of these are automatic and pay certificates only, no cash.

**Judging, 25% each:** Technical Depth (a real pipeline behind the UI), Rigor & Reproducibility (held-out eval, clinical-unit metric, seeds, configs, code), Clinical Relevance & Honesty (scope and harms stated, accuracy claim matches evidence), Demo Quality (working within the first 60 s, followable without installing anything). Ties go to the stronger held-out evaluation.

**Verified submission requirements:**
- Public repo whose README covers what the project does, how to run it, dependencies, configuration and how to reproduce the evaluation.
- A video of at least 60 s showing the project working end to end. The builder records it.
- Written description with: the problem and who has it, the method, an **Evaluation** section naming the metric and how it is measured, a **"Who benefits, and who could be harmed"** section, limitations, and what you would do with one more month.
- Full attribution for every model, dataset and piece of code you did not write.
- A line in the README naming the AI tools used and what they did.
- The project must work today. Use public datasets or your own recordings only. No video of identifiable people without consent.
- Without an Evaluation section, Technical Depth and Rigor scores are capped at half. Judges may ask what a specific function does.

## 2. Current state

Identity: see IDENTITY.md (direction D9, structure S2, archetype L1, kit K2)

**Routes -> files**
- `/` -> `app/page.tsx`: L1 poster landing. The display headline sits at clamp(3.5rem, 9vw, 8rem) with one CTA under it. Then the scene-1 horizon band and strata, then the full-width pinned live frame, then problem, refusals and the strip list.
- `/digitize` -> `app/digitize/page.tsx` + `components/workspace.tsx`: the workspace. `?strip=<id>` preloads an example, and the landing CTA uses it.
- `/digitize/[id]` -> `app/digitize/[id]/page.tsx`: a shareable result. Seeded ids are computed on the server with the same pipeline and statically generated. `local-*` ids render `components/local-result.tsx` from sessionStorage, because uploads never leave the device.
- `/how` -> `app/how/page.tsx` + `components/bench-panel.tsx`: method, live synthetic bench, who benefits and who is harmed, limits, credits.

**Navigation:** the header (`components/site-header.tsx`) has two links ("Example result", "Method & evaluation") plus the CTA "Digitize a strip". The links live in `components/nav-links.tsx` (client), which marks the current route with `aria-current="page"` and an oxblood underline. The footer links to Workspace and Method.

**One-mark proof:** the header home link, quoted from `components/site-header.tsx`:
```tsx
<Link href="/" className="flex items-center gap-2.5 font-display text-xl font-semibold text-foreground">
  <BrandMark size={30} />
  Kymora
</Link>
```

**What is real**
- `lib/kymora/pipeline.ts`: the full digitizer (masks, `estimateSkew`, `rotateChannel`, `gridPeriod`, `extractTrace`, `traceToSignal`, `detectRPeaks`, `digitize` with the quality gate, `baselineDigitize`, `toCsv`). Pure TS, runs in the browser and in Node.
- `lib/kymora/synth.ts`: seeded strip renderer (beat model, grid, ink, blur, tilt, shadow, noise) plus exact ground truth (`referenceFor`).
- `lib/kymora/bench.ts`: bench strips, metrics (HR MAE, RR MAE, SNR, rejection rate), summary, histogram, `formatTable`.
- `scripts/eval.ts`: `npm run eval`, deterministic with `--seed`/`--n`, writes `eval/results.json`.
- `scripts/seed.ts`: `npm run seed`, prints the 12 strip ids and reference bpm, writes nothing.
- `lib/adapter.ts` + `lib/types.ts`: the data seam. `/digitize`, `/digitize/[id]` and `/how` read through `getAdapter()`. API stubs `/api/strips`, `/api/strips/[id]`, `/api/bench` return `ApiResponse<T>`.
- Workspace: run any of the 12 seeded strips (`lib/data.ts`) or drop your own photo, see the overlay, download CSV, copy the result link.

**What is mocked or stubbed**
- The held-out set (`data/ptbxl-fold10/`) and `eval/ptbxl-results.json` are not generated yet. The loader and the scoring are in place (Phase 2); the human run is in the Phase 2 checklist.
- The demo strips are synthetic (Gaussian beat model), not PTB-XL waveforms. The UI says so.
- `ADAPTER_MODE=real` serves the held-out results only when the committed results file is valid; strips, runs and the bench stay synthetic.
- The README result blocks are filled by `npm run proof`.

**Interaction kit K2 (gsap)**
- Shipped: signature 1, the pinned scroll scene (`components/strip-scene.tsx`). The landing frame pins while a scrubbed timeline undoes the estimated tilt, fades the grid, draws the digitized trace, pops the R peaks and counts the measured bpm up, all from a real pipeline run on the featured strip at build time. The server HTML shows the finished state, and the animation is skipped under reduced motion.
- To do: signature 2, an intro timeline on first paint. Split the landing h1 into word spans by hand, stagger them, then bring in the scene frame. Animate from the visible state so no-JS HTML stays readable.
- To do: signature 3, a figure tween bound to a control. On `/how` or the result page, switching between Kymora and baseline (a Button pair) tweens the displayed HR MAE and the matching histogram bar heights together, driven by the real bench summary.

**Brand pack:** `public/logo.svg` and `app/icon.svg` (a grid tile with one oxblood PQRST wave and a sun disc), `app/opengraph-image.tsx`, and `public/illustrations/scene-1..3.svg` for the three `<SceneSlot>`s (landing hero band, landing problem section, /how).

**Other files:** `app/globals.css` (IDENTITY tokens, M3 `kymora-scale-in` keyframe with a reduced-motion block), `components/ui/*` (restyled with matte fills, soft 0.375rem radius, no shadows), `components/result-view.tsx` (canvas, SVG overlay, figures, CSV and link actions).

## 3. Mission (in priority order)

1. **Held-out PTB-XL fold 10 set (2.5 h, do this first).** Python: `wfdb` reads PTB-XL records with `strat_fold == 10`. Take 300 records, render lead II rhythm strips with ECG-Image-Kit using a fixed seed and a committed config (tilt, blur, JPEG, shadow), and write `data/ptbxl-fold10/manifest.json` with reference R peaks taken from the signal (or PTB-XL+ annotations, with attribution). Add `pngjs` (plus types) and implement `loadPtbxlFold10()` so it feeds the existing `rrMae`/`snrDb` scoring. Done means `npm run eval -- --set ptbxl` prints a table with Kymora, baseline and baseline-on-accepted rows. If ECG-Image-Kit eats more than an hour, render with a small seeded Python script and say so in the README.
2. **Tune on synthetic only, never on fold 10 (1 h).** Run `npm run eval` and look at the false rejections and the worst HR errors. Adjust `CONFIG`. Write the final table into the README. Done means the README table is real and the CONFIG is printed next to it.
3. **Real photo check, the wow moment (1 h).** Print 3 PTB-XL fold 10 strips, photograph them tilted on a desk, drop them into `/digitize`, and record measured vs reference in a separate small README table. Rehearse: drop the tilted photo, the trace settles on the ink, "72 bpm, RR 833 ms" appears with the reference next to it. Then drop a blurred photo and show "quality 0.31, no measurement". If real photos fail, fix the gate or the masks before polishing anything else.
4. **Eval panel polish (1 h).** Show the PTB-XL table on `/how` as a static import of a committed `eval/ptbxl-results.json` (keep the live synthetic bench too). Build signature 3 here. Done means a judge sees Kymora vs baseline HR MAE, RR MAE, SNR and rejection rate within 10 s of opening `/how`.
5. **Workspace polish (1.5 h).** Signature 2 on the landing page. Show a reference value for uploaded PTB-XL photos when the filename matches an ecg_id in a small committed lookup. Keyboard focus states on the strip buttons. Done means the 0:00 to 0:45 part of the demo script runs without a hitch.
6. **Logo pass (0.5 h).** Check `public/logo.svg` at 28 px and 512 px. If you upload a raster to `public/brand/logo.png`, BrandMark switches to it automatically. Use the same mark on the video cover.
7. **Docs and video (2 h).** README sections are in place: fill in the results, check the PTB-XL and ECG-Image-Kit licenses on their pages, keep the AI use line accurate. Then record the 90 s video: 0 to 15 s drop the tilted strip and show the trace and px/mm; 15 to 45 s peaks, HR/RR vs reference, CSV, then the blurred photo rejected; 45 to 75 s `npm run eval` with seed 42 and the eval panel; 75 to 90 s the limits card, the real desk photo, logo.

## 4. Constraints

- Stack: Next.js 15 App Router, TypeScript strict, Tailwind v4 (no tailwind.config), shadcn primitives in `components/ui/`, deployed on Vercel. No server routes that receive images, no runtime filesystem writes.
- IDENTITY.md is law for every color, font, route, layout and animation decision. Colors come only from the tokens in `app/globals.css`, never a raw hex in a component. Spectral for h1/h2, Rubik for body. Soft 0.375rem radius everywhere. The header stays solid ground with a LINE border. Every GSAP call goes inside `useGSAP` with `gsap.matchMedia()` and a reduced-motion skip.
- Keep the pipeline honest: no number on screen that the code did not compute. Synthetic results are always labelled synthetic. Never tune on fold 10.
- Writing for any user-facing copy: no em or en dashes, no double-hyphen dashes, none of these words: seamless, leverage, empower, revolutionize, streamline, game-changer, cutting-edge, delve, robust, unlock, elevate, harness, effortless. Plain human tone with concrete numbers.
- Scope discipline: if something threatens the deadline, cut scope (for example drop signature 2) rather than polish. The held-out evaluation outranks every UI task.
- Keep `npm run build` passing after every change. The landing page and the 12 result pages run the pipeline at build time, so a pipeline exception breaks the build. Guard it.

## 5. Definition of done

- Deployed at https://kymora.vercel.app, and the README demo link works.
- `npm run eval` and `npm run eval -- --set ptbxl` both reproduce the README tables from a clean clone.
- The README has the Evaluation, Who benefits / who could be harmed, Limitations, One more month, Attribution and AI use sections filled in with real numbers.
- The 90-second demo flow works end to end: seeded strip, own photo, rejection, CSV, eval panel.
- Wow moment rehearsed with a real printed strip photographed on the desk, showing the measured and reference bpm side by side.

## Manual submit checklist (human, before the 4 December 2026 23:45 EST deadline)

- [ ] Student enrollment proof for every team member, ready for Devpost (students only, age 14 or older).
- [ ] Team member names entered in the Devpost form (they are deliberately not written in any repo file).
- [ ] Add a LICENSE file of the team's choice, then update the "License" section in README.md.
- [ ] Run `npm run proof`, then paste SUBMISSION.md into the Devpost form field by field.
- [ ] Paste your own video link into the Devpost video field (at least 60 s, end to end, following DEMO.md).
- [ ] Open https://kymora-eight.vercel.app cold on a phone (private window), click "Digitize an example strip", and check that a result appears.
- [ ] Confirm the Phase 2 manual checklist was done (held-out set, `eval/ptbxl-results.json`, `ADAPTER_MODE=real`, redeploy) and that `npm run lookup` was run and its output committed; if not, leave the README and SUBMISSION.md wording as it is, which already says the held-out table is not generated.
