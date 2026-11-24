/**
 * The real adapter: serves the committed held-out PTB-XL fold 10 results. Strip
 * pages, runs and the live bench still come from the fake implementations (seeded
 * synthetic strips, labelled synthetic per item), because PTB-XL images are not
 * committed. Only lib/adapter.ts imports this file.
 */
import { fakeAdapter, type KymoraAdapter } from "./adapter-fake";
import type { HeldOutResults } from "./schemas";

export function makeRealAdapter(heldOut: HeldOutResults): KymoraAdapter {
  return {
    mode: "real",
    featuredStripId: fakeAdapter.featuredStripId,
    listStrips: () => fakeAdapter.listStrips(),
    listSummaries: () => fakeAdapter.listSummaries(),
    getStrip: (id) => fakeAdapter.getStrip(id),
    getRun: (id) => fakeAdapter.getRun(id),
    getResult: (id) => fakeAdapter.getResult(id),
    getBenchConfig: () => fakeAdapter.getBenchConfig(),
    getBench: () => fakeAdapter.getBench(),
    getHeldOut: () => heldOut,
  };
}
