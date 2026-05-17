import type { Face, Vec3 } from '../../types.ts';
import { makeFace } from '../archimedean/_utils.ts';

export interface PyramidGeometry {
  /** Base n-gon vertices, length n. */
  base: Vec3[];
  /** Apex on the symmetry axis. */
  apex: Vec3;
  /** Perpendicular distance from base plane to apex. */
  height: number;
}

/**
 * Vertex layout of a unit-edge n-pyramid (n = 3, 4, 5).
 *
 * - Base regular n-gon at z = zBase, circumradius r = 1/(2·sin(π/n))
 *   → base edges have unit length. Vertex i at angle 2πi/n.
 * - Apex at (0, 0, zBase + topZSign·h) with h² = 1 − r²
 *   → lateral edges from apex to each base vertex are unit.
 *
 * For n ≥ 6 the base circumradius is ≥ 1, so h² ≤ 0 — no equilateral pyramid
 * exists with hexagonal or larger base. n = 3 produces the regular tetrahedron
 * (Platonic, not a Johnson solid); it's used here as a building block of J7.
 */
export function pyramidVertices(
  n: 3 | 4 | 5,
  options: { zBase?: number; topZSign?: 1 | -1 } = {},
): PyramidGeometry {
  const zBase = options.zBase ?? 0;
  const topZSign = options.topZSign ?? 1;
  const rBase = 1 / (2 * Math.sin(Math.PI / n));
  const h2 = 1 - rBase * rBase;
  if (h2 <= 0) {
    throw new Error(`pyramidVertices: degenerate height for n=${n}`);
  }
  const h = Math.sqrt(h2);

  const apex: Vec3 = [0, 0, zBase + topZSign * h];
  const base: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    base.push([rBase * Math.cos(t), rBase * Math.sin(t), zBase]);
  }
  return { base, apex, height: h };
}

/**
 * Append the n lateral triangles of a pyramid to `faces`. `idRef.value` is
 * incremented for every face appended.
 */
export function appendPyramidSides(
  faces: Face[],
  base: Vec3[],
  apex: Vec3,
  idRef: { value: number },
): void {
  const n = base.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push(makeFace(idRef.value++, [apex, base[i]!, base[j]!]));
  }
}

/**
 * Standalone unit-edge n-pyramid, centered so the midplane between apex and
 * base sits at z = 0. Returns 1 + n faces: 1 base n-gon + n lateral triangles.
 */
export function uniformPyramid(n: 3 | 4 | 5): Face[] {
  const geom = pyramidVertices(n, { zBase: 0, topZSign: 1 });
  const dz = -geom.height / 2;
  const apex: Vec3 = [geom.apex[0], geom.apex[1], geom.apex[2] + dz];
  const base = geom.base.map((v) => [v[0], v[1], v[2] + dz] as Vec3);

  const faces: Face[] = [];
  const id = { value: 0 };
  faces.push(makeFace(id.value++, [...base]));
  appendPyramidSides(faces, base, apex, id);
  return faces;
}
