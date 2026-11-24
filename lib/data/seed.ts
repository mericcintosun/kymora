/**
 * Fixed-id seeded strips. lib/data.ts stays where it is so no import breaks;
 * this module is the stable entry point for the seed script and the adapter.
 * Deterministic: no clock, no random source, every strip carries its own integer seed.
 */
export { FEATURED_STRIP_ID, stripById, strips as seedStrips } from "../data";
export type { StressTest, StripSeed } from "../data";
