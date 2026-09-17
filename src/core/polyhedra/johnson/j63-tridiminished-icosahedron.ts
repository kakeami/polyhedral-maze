import type { Face } from '../../types.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { diminishVertex, rawIcosahedronFaces, ICOSA_VERTEX } from './_diminish.ts';

/**
 * Tridiminished Icosahedron (J63). Icosahedron with three mutually
 * non-adjacent, non-antipodal vertices removed. 8 faces: 5 △ + 3 ⬠.
 *
 * v0, v2, v7 are pairwise equidistant on the icosahedron and form the
 * canonical mutually-meta triple used for J63 / J64.
 */
export function tridiminishedFaces(): Face[] {
  let f = rawIcosahedronFaces();
  f = diminishVertex(f, ICOSA_VERTEX.v0!);
  f = diminishVertex(f, ICOSA_VERTEX.v2!);
  f = diminishVertex(f, ICOSA_VERTEX.v7!);
  return f;
}

export class TridiminishedIcosahedron extends Solid {
  protected readonly _faces = normalizeFaces(tridiminishedFaces(), 1);
}
