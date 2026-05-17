import type { Face } from '../../types.ts';
import { dualize } from '../catalan/_dualize.ts';
import { uniformPrism } from '../prismatic/_uniform_prism.ts';

/**
 * Uniform n-bipyramid as the polar reciprocal of the uniform n-prism.
 *
 * Returns 2n triangular faces (apex + two consecutive equator vertices),
 * with n+2 vertices (two apexes + n-gon equator). Faces are isosceles but
 * are not exactly congruent for n ≠ 4 because the uniform prism does not
 * have an exact midsphere — `dualize` averages the two distinct edge-midpoint
 * radii. Topology and outward-pointing normals are correct in all cases.
 */
export function uniformBipyramid(n: number): Face[] {
  if (n < 3) {
    throw new Error(`uniformBipyramid: n must be >= 3 (got ${n})`);
  }
  return dualize(uniformPrism(n));
}
