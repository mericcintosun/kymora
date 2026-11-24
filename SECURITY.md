# SECURITY: Kymora

Kymora is a static Next.js site plus in-browser signal processing. It has no accounts, no database, no chain and no secrets.

## Contract addresses and chain id

None. Kymora has no smart contracts, no `contracts/` directory and no blockchain dependency, so there is no chain id.

## Wallet permissions

None requested. The app never asks to connect a wallet, never calls `window.ethereum`, and never asks for a signature. A grep over `app/`, `components/` and `lib/` for `eth_requestAccounts`, `eth_sign`, `personal_sign`, `window.ethereum`, `approve(` and `connect(` returns no matches.

## Approvals

None. There are no token approvals of any kind, bounded or unbounded.

## Source repo

https://github.com/mericcintosun/kymora

## Data handling

A dropped photo is decoded on your device: `createImageBitmap` reads it into a canvas in your tab, and the pipeline in `lib/kymora/pipeline.ts` runs there. Nothing is uploaded. No server route receives images: the only API routes (`/api/strips`, `/api/strips/[id]`, `/api/bench`) return seeded synthetic data and accept no request body. The only stored state is `sessionStorage` in your own tab, under keys named `kymora:<id>`, holding the measurement and a downscaled copy of the photo so the result page can be reopened in that tab. It is cleared when the tab closes. There are no cookies, no analytics and no third-party scripts in the app code. No environment variable holds a secret: `ADAPTER_MODE` is a plain switch and `NEXT_PUBLIC_BRAND_FILES` lists public image names.

To report a problem, open an issue on the source repo.
