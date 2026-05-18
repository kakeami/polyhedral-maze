import type { Face, Vec3 } from '../../types.ts';
import { makeFace } from '../archimedean/_utils.ts';

/**
 * n-trapezohedron with apex height = equator radius (aspect H/r = 1).
 *
 * Unlike the polar reciprocal of a unit-edge antiprism (which becomes sharply
 * pointed for large n), this construction fixes the apex/equator proportion
 * regardless of n.
 *
 * Geometry:
 *   - Apexes at (0, 0, ±H), H = r = 1.
 *   - Upper equator ring of n points at z=+z_eq, angles (2k+1)·π/n.
 *   - Lower equator ring of n points at z=−z_eq, angles 2k·π/n.
 *   - z_eq = H · tan²(π/(2n)) is the unique value that makes every kite
 *     planar (derived from the coplanarity of apex + 2 upper + 1 lower
 *     vertices with n-fold symmetry).
 *
 * Each top kite contains [topApex, upper[i-1], lower[i], upper[i]]; bottom
 * kites mirror this. Returns 2n kite faces, 2n+2 vertices, 4n edges.
 */
export function compactTrapezohedron(n: number): Face[] {
  if (n < 3) {
    throw new Error(`compactTrapezohedron: n must be >= 3 (got ${n})`);
  }
  const r = 1;
  const H = r;
  const t = Math.tan(Math.PI / (2 * n));
  const zEq = H * t * t;

  const upper: Vec3[] = [];
  const lower: Vec3[] = [];
  for (let k = 0; k < n; k++) {
    const aUpper = ((2 * k + 1) * Math.PI) / n;
    const aLower = (2 * k * Math.PI) / n;
    upper.push([r * Math.cos(aUpper), r * Math.sin(aUpper), zEq]);
    lower.push([r * Math.cos(aLower), r * Math.sin(aLower), -zEq]);
  }
  const topApex: Vec3 = [0, 0, H];
  const botApex: Vec3 = [0, 0, -H];

  const faces: Face[] = [];
  let id = 0;
  for (let i = 0; i < n; i++) {
    const iPrev = (i - 1 + n) % n;
    faces.push(
      makeFace(id++, [topApex, upper[iPrev]!, lower[i]!, upper[i]!]),
    );
  }
  for (let j = 0; j < n; j++) {
    const jNext = (j + 1) % n;
    faces.push(
      makeFace(id++, [botApex, lower[j]!, upper[j]!, lower[jNext]!]),
    );
  }
  return faces;
}
