/**
 * npm run seed
 *
 * Prints the 12 seeded strip ids with their true reference heart rate. The strips
 * are generated from fixed integer seeds in lib/data.ts, so there is nothing to
 * write: running this twice prints the same lines and changes no file.
 */
import { fakeAdapter } from "../lib/adapter";

const rows = fakeAdapter.listSummaries();
const width = Math.max(...rows.map((r) => r.id.length));

console.log(`Kymora seeded strips (${rows.length}, synthetic)`);
for (const r of rows) {
  console.log(`${r.id.padEnd(width)}  ${r.referenceBpm.toFixed(1)} bpm  ${r.stress}`);
}
console.log(`featured: ${fakeAdapter.featuredStripId}`);
