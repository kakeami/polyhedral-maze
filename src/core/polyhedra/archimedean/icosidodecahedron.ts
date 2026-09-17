import type { Face, Vec3 } from '../../types.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { rectify } from './_rectify.ts';

/**
 * Icosidodecahedron: rectified icosahedron.
 * 20 triangular faces + 12 pentagonal faces = 32 faces.
 */
function makeFaces(): Face[] {
  const phi = (1 + Math.sqrt(5)) / 2;
  const V: Vec3[] = [
    [0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi],
    [1, phi, 0], [-1, phi, 0], [1, -phi, 0], [-1, -phi, 0],
    [phi, 0, 1], [-phi, 0, 1], [phi, 0, -1], [-phi, 0, -1],
  ];
  const F: number[][] = [
    [0, 1, 8], [0, 8, 4], [0, 4, 5], [0, 5, 9], [0, 9, 1],
    [3, 6, 10], [3, 10, 2], [3, 2, 11], [3, 11, 7], [3, 7, 6],
    [1, 6, 8], [8, 6, 10], [8, 10, 4], [4, 10, 2], [4, 2, 5],
    [5, 2, 11], [5, 11, 9], [9, 11, 7], [9, 7, 1], [1, 7, 6],
  ];
  return rectify(V, F);
}

export class Icosidodecahedron extends Solid {
  protected readonly _faces = normalizeFaces(makeFaces(), 1);
}
