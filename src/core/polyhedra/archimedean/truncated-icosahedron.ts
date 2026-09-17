import type { Face, Vec3 } from '../../types.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { truncate } from './_truncation.ts';

/**
 * Truncated Icosahedron (the soccer ball): 12 pentagonal + 20 hexagonal = 32 faces.
 * Obtained by truncating each vertex of a regular icosahedron at t = 1/3.
 */
function makeFaces(): Face[] {
  const phi = (1 + Math.sqrt(5)) / 2;

  const V: Vec3[] = [
    [0, 1, phi],     // 0
    [0, -1, phi],    // 1
    [0, 1, -phi],    // 2
    [0, -1, -phi],   // 3
    [1, phi, 0],     // 4
    [-1, phi, 0],    // 5
    [1, -phi, 0],    // 6
    [-1, -phi, 0],   // 7
    [phi, 0, 1],     // 8
    [-phi, 0, 1],    // 9
    [phi, 0, -1],    // 10
    [-phi, 0, -1],   // 11
  ];

  // 20 triangular faces of the icosahedron (each cyclic from outside).
  const F: number[][] = [
    [0, 1, 8], [0, 8, 4], [0, 4, 5], [0, 5, 9], [0, 9, 1],
    [3, 6, 10], [3, 10, 2], [3, 2, 11], [3, 11, 7], [3, 7, 6],
    [1, 6, 8], [8, 6, 10], [8, 10, 4], [4, 10, 2], [4, 2, 5],
    [5, 2, 11], [5, 11, 9], [9, 11, 7], [9, 7, 1], [1, 7, 6],
  ];

  return truncate(V, F, 1 / 3);
}

export class TruncatedIcosahedron extends Solid {
  protected readonly _faces = normalizeFaces(makeFaces(), 1);
}
