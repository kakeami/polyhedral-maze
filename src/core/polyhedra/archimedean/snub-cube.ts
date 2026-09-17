import type { Face, Vec3 } from '../../types.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { snub } from './_snub.ts';

/**
 * Snub Cube (a.k.a. snub cuboctahedron): 6 squares + 32 triangles = 38 faces,
 * 24 vertices, 60 edges. Chiral; this implementation is the right-handed form.
 *
 * Constructed by applying the snub operation to a cube:
 *   - 6 square faces → 6 rotated squares
 *   - 12 cube edges  → 24 edge-band triangles
 *   - 8 cube vertices→ 8 vertex triangles
 */
function makeFaces(): Face[] {
  const V: Vec3[] = [
    [0.5, 0.5, 0.5],
    [-0.5, 0.5, 0.5],
    [-0.5, -0.5, 0.5],
    [0.5, -0.5, 0.5],
    [0.5, 0.5, -0.5],
    [-0.5, 0.5, -0.5],
    [-0.5, -0.5, -0.5],
    [0.5, -0.5, -0.5],
  ];
  const F: number[][] = [
    [0, 1, 2, 3], // +z
    [4, 7, 6, 5], // -z
    [0, 4, 5, 1], // +y
    [2, 6, 7, 3], // -y
    [0, 3, 7, 4], // +x
    [1, 5, 6, 2], // -x
  ];
  return snub(V, F, 'right');
}

export class SnubCube extends Solid {
  protected readonly _faces = normalizeFaces(makeFaces(), 1);
}
