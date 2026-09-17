import type { Face, Vec3 } from '../../types.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { truncate } from './_truncation.ts';

/**
 * Truncated Octahedron: 6 square faces + 8 hexagonal faces = 14 faces.
 * Obtained by truncating each vertex of a regular octahedron at t = 1/3.
 */
function makeFaces(): Face[] {
  const V: Vec3[] = [
    [1, 0, 0],   // 0: +x
    [-1, 0, 0],  // 1: -x
    [0, 1, 0],   // 2: +y
    [0, -1, 0],  // 3: -y
    [0, 0, 1],   // 4: +z
    [0, 0, -1],  // 5: -z
  ];
  // 8 triangular faces of the octahedron (each cyclic from outside).
  const F: number[][] = [
    [0, 2, 4],
    [0, 4, 3],
    [0, 3, 5],
    [0, 5, 2],
    [1, 4, 2],
    [1, 3, 4],
    [1, 5, 3],
    [1, 2, 5],
  ];
  return truncate(V, F, 1 / 3);
}

export class TruncatedOctahedron extends Solid {
  protected readonly _faces = normalizeFaces(makeFaces(), 1);
}
