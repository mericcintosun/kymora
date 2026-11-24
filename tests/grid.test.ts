import assert from "node:assert/strict";
import { test } from "node:test";
import { gridPeriod } from "../lib/kymora/pipeline";

/**
 * A grid profile shaped like a lightly blurred phone photo: strong 5 mm lines
 * every 40 px and faint 1 mm lines every 8 px. The mean-subtracted autocorrelation
 * puts the 1 mm rungs below zero, which is the case that read 8 px/mm as 40.
 */
function profile(pxPerMm: number, minorAmp: number, majorAmp: number, length = 2000): Float64Array {
  const pulse = [1, 3, 5, 5, 3, 1].map((v) => v / 9);
  const p = new Float64Array(length).fill(1);
  for (let k = 0; k * pxPerMm < length; k++) {
    const amp = k % 5 === 0 ? majorAmp : minorAmp;
    const at = Math.round(k * pxPerMm) - 3;
    pulse.forEach((v, j) => {
      if (at + j >= 0 && at + j < length) p[at + j] += amp * v;
    });
  }
  return p;
}

test("gridPeriod reads the 1 mm spacing when strong 5 mm lines dominate", () => {
  // With these amplitudes r at the 1 mm lag is about -0.05: a clear local peak below zero.
  const g = gridPeriod(profile(8, 4, 65));
  assert.ok(g, "grid found");
  assert.ok(Math.abs(g.pxPerMm - 8) < 0.2, `expected about 8 px/mm, got ${g.pxPerMm}`);
});

test("gridPeriod keeps a clean 1 mm grid at its own spacing", () => {
  const g = gridPeriod(profile(6, 30, 60));
  assert.ok(g, "grid found");
  assert.ok(Math.abs(g.pxPerMm - 6) < 0.2, `expected about 6 px/mm, got ${g.pxPerMm}`);
});
