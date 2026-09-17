import type { Face, Vec3 } from '../../types.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { truncate } from './_truncation.ts';

/**
 * Truncated Tetrahedron: 4 triangular faces + 4 hexagonal faces = 8 faces.
 * Obtained by truncating each vertex of a regular tetrahedron at t = 1/3.
 */
function makeFaces(): Face[] {
  const V: Vec3[] = [
    [1, 1, 1],
    [1, -1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
  ];
  const F: number[][] = [
    [0, 1, 2],
    [0, 2, 3],
    [0, 3, 1],
    [1, 3, 2],
  ];
  return truncate(V, F, 1 / 3);
}

export class TruncatedTetrahedron extends Solid {
  protected readonly _faces = normalizeFaces(makeFaces(), 1);
}
