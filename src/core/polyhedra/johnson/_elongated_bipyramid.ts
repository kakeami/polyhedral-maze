import type { Face, Vec3 } from '../../types.ts';
import { makeFace } from '../archimedean/_utils.ts';

/**
 * Unit-edge n-elongated bipyramid (n = 3, 4, 5): two regular n-pyramids
 * attached to the top and bottom of a regular n-prism.
 *
 * - Prism rings at z = ±1/2 (unit height), n-gon circumradius r = 1/(2·sin(π/n)).
 * - Apexes on the z-axis at z = ±(1/2 + h_pyr) with h_pyr² = 1 − r².
 *
 * Returns 3n faces: n upper triangles + n lower triangles + n prism rectangles.
 * The intermediate n-gons (where the pyramids meet the prism) are not faces.
 */
export function uniformElongatedBipyramid(n: 3 | 4 | 5): Face[] {
  const r = 1 / (2 * Math.sin(Math.PI / n));
  const hPyr2 = 1 - r * r;
  if (hPyr2 <= 0) {
    throw new Error(`uniformElongatedBipyramid: degenerate pyramid for n=${n}`);
  }
  const hPyr = Math.sqrt(hPyr2);
  const halfPrism = 0.5;

  const topApex: Vec3 = [0, 0, halfPrism + hPyr];
  const botApex: Vec3 = [0, 0, -(halfPrism + hPyr)];
  const topRing: Vec3[] = [];
  const botRing: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    const x = r * Math.cos(t);
    const y = r * Math.sin(t);
    topRing.push([x, y, halfPrism]);
    botRing.push([x, y, -halfPrism]);
  }

  const faces: Face[] = [];
  const id = { value: 0 };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push(makeFace(id.value++, [topApex, topRing[i]!, topRing[j]!]));
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push(makeFace(id.value++, [botApex, botRing[i]!, botRing[j]!]));
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push(
      makeFace(id.value++, [topRing[i]!, topRing[j]!, botRing[j]!, botRing[i]!]),
    );
  }
  return faces;
}
