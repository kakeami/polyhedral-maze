import type { Face } from '../../types.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { augmentWithPyramid } from './_augment.ts';
import { sphenocoronaFaces } from './j86-sphenocorona.ts';

/**
 * Augmented Sphenocorona (J87). Sphenocorona (J86) with a square pyramid (J1)
 * attached to one of its two square faces. 17 faces (16 triangles + 1 square),
 * 11 vertices, 26 edges.
 *
 * The two squares of J86 are related by its C_2 symmetry, so the choice of
 * host face does not affect the resulting shape — pick the first 4-gon.
 */
function augmentedSphenocoronaFaces(): Face[] {
  const base = sphenocoronaFaces();
  const hostId = base.find((f) => f.vertices.length === 4)?.id;
  if (hostId === undefined) {
    throw new Error('augmentedSphenocorona: no square face found on base');
  }
  return augmentWithPyramid(base, hostId);
}

export class AugmentedSphenocorona extends Solid {
  protected readonly _faces = normalizeFaces(augmentedSphenocoronaFaces(), 1);
}
