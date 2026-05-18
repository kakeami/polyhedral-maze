import type { Face, Vec3 } from '../../types.ts';
import { makeFace } from '../archimedean/_utils.ts';

/**
 * n-bipyramid with apex height = equator circumradius (aspect h/r = 1).
 *
 * Unlike the polar reciprocal of a unit-edge prism (which becomes sharply
 * pointed for large n because the prism is wide and flat), this construction
 * fixes the apex/equator proportion regardless of n. Triangles are isosceles
 * with apex angle 2·atan(sin(π/n)).
 *
 * Returns 2n triangle faces, n+2 vertices, 3n edges. `makeFace` orients each
 * face so the normal points outward.
 */
export function compactBipyramid(n: number): Face[] {
  if (n < 3) {
    throw new Error(`compactBipyramid: n must be >= 3 (got ${n})`);
  }
  const r = 1;
  const h = r;

  const equator: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    equator.push([r * Math.cos(t), r * Math.sin(t), 0]);
  }
  const topApex: Vec3 = [0, 0, h];
  const botApex: Vec3 = [0, 0, -h];

  const faces: Face[] = [];
  let id = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push(makeFace(id++, [topApex, equator[i]!, equator[j]!]));
    faces.push(makeFace(id++, [botApex, equator[i]!, equator[j]!]));
  }
  return faces;
}
