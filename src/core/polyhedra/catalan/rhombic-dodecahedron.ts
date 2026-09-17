import type { Face } from '../../types.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { Cuboctahedron } from '../archimedean/cuboctahedron.ts';
import { dualize } from './_dualize.ts';

/**
 * Rhombic Dodecahedron: dual of the Cuboctahedron.
 * 12 rhombic faces, 14 vertices.
 */
export class RhombicDodecahedron extends Solid {
  protected readonly _faces: Face[] = normalizeFaces(dualize(new Cuboctahedron().faces()), 1);
}
