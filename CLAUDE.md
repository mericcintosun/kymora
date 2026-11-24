# CLAUDE.md: Kymora

Read `IDENTITY.md` first (it overrides taste), then `HANDOFF.md`, then `DEMO.md` (the 90 second demo contract).

## Commands

- `npm run dev`: local dev server on http://localhost:3000
- `npm run build`: production build. The landing page and the 12 result pages run the pipeline at build time.
- `npm run eval`: synthetic bench, seed 42, 200 strips, writes `eval/results.json`. `npm run eval -- --seed 7 --n 500` for other sizes. `--set ptbxl` throws until Phase 2 implements `loadPtbxlFold10()`.
- `npm run seed`: prints the 12 seeded strip ids and their reference bpm. Writes nothing, so it is idempotent.

## Data seam

- Pages and API routes read seeded data through `getAdapter()` in `lib/adapter.ts`. Shared types live in `lib/types.ts`.
- `ADAPTER_MODE` (`fake` by default, see `.env.example`). `real` still returns the fake adapter until Phase 2 swaps in PTB-XL results.
- API stubs: `/api/strips`, `/api/strips/[id]`, `/api/bench`. They return `ApiResponse<T>`. None of them accepts images.

## Stack pitfalls

- Tailwind v4: there is no `tailwind.config`. Tokens live in the `@theme inline` block of `app/globals.css`.
- `useSearchParams` only under a `Suspense` boundary. Server pages read `searchParams` as a Promise instead.
- A pipeline exception during prerender breaks the static build. Guard new build-time pipeline calls with try/catch.
- Next.js 15: `params` and `searchParams` are Promises in pages and route handlers.

## Never touch

- `public/illustrations/*`, `public/logo.svg`, `app/icon.svg`.
- `lib/kymora/` logic (`pipeline.ts`, `synth.ts`, `bench.ts`) unless the current phase says so.

## Vercel guardrails

- No runtime filesystem writes. No server route that receives images.
- `useSearchParams` under `Suspense`.
- No Node-only APIs (`fs`, `path`, `child_process`) in edge paths or client components.
- No custom server and no `output: export`.
- Every `process.env` key is mirrored in `.env.example`.

## Identity and banned list

See `IDENTITY.md`. Colors only through the tokens in `app/globals.css`; no hex in components (the one documented exception is `app/opengraph-image.tsx`). Spectral for h1/h2, Rubik for body, radius 0.375rem, solid ground header with a LINE border, keyframes prefixed `kymora-`, all GSAP inside `useGSAP` with `gsap.matchMedia()` and a reduced-motion skip.

Never introduce: dark navy hexes, teal/mint/cyan/sky hexes, amber as brand; keyframes `fade-up`, `float`, `float-y`, `glow-pulse`, `caret-blink`, `pulse-dot`; three-dot browser chrome, fake console cards, mono stat strips, big-number stat tile bands, numbered tab steppers, pulse-dot badges, `--delay` or `--d` stagger styles, masked right-half washes, translucent `backdrop-blur` headers; more than one brand mark in the header.

Writing: no em dash, en dash or double hyphen as a dash. Banned words: seamless, seamlessly, leverage, empower, revolutionize, streamline, game-changer, cutting-edge, delve, robust, unlock, elevate, harness, effortless.

when compacting preserve the list of modified files and test commands
