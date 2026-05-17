import type { Face } from '../../types.ts';
import { dualize } from '../catalan/_dualize.ts';
import { uniformAntiprism } from '../prismatic/_uniform_antiprism.ts';

/**
 * Uniform n-trapezohedron as the polar reciprocal of the uniform n-antiprism.
 *
 * Returns 2n kite faces, with 2n+2 vertices (two apexes + 2n zigzag equator
 * vertices). `dualize` averages the two distinct edge-midpoint radii of the
 * uniform antiprism, so the kites are near-congruent but not exact for
 * arbitrary n. Topology and outward-pointing normals are correct.
 */
export function uniformTrapezohedron(n: number): Face[] {
  if (n < 3) {
    throw new Error(`uniformTrapezohedron: n must be >= 3 (got ${n})`);
  }
  return dualize(uniformAntiprism(n));
}
