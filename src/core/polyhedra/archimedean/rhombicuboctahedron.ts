import type { Face, Vec3 } from '../../types.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { cantellate } from './_cantellate.ts';

/**
 * Rhombicuboctahedron: cantellated cube.
 * 8 triangular faces + 18 square faces = 26 faces.
 *
 * Built from unit cube vertices (±1, ±1, ±1) with edge length 2.
 * Cantellation offset d = √2 yields canonical edge length 2 throughout.
 */
function makeFaces(): Face[] {
  const V: Vec3[] = [
    [1, 1, 1],     // 0
    [1, 1, -1],    // 1
    [1, -1, 1],    // 2
    [1, -1, -1],   // 3
    [-1, 1, 1],    // 4
    [-1, 1, -1],   // 5
    [-1, -1, 1],   // 6
    [-1, -1, -1],  // 7
  ];
  // 6 cube faces (vertices in cyclic order).
  const F: number[][] = [
    [0, 1, 3, 2], // +x
    [4, 6, 7, 5], // -x
    [0, 4, 5, 1], // +y
    [2, 3, 7, 6], // -y
    [0, 2, 6, 4], // +z
    [1, 5, 7, 3], // -z
  ];
  return cantellate(V, F, Math.SQRT2);
}

export class Rhombicuboctahedron extends Solid {
  protected readonly _faces = normalizeFaces(makeFaces(), 1);
}
