import type { Face } from '../../types.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { Icosidodecahedron } from '../archimedean/icosidodecahedron.ts';
import { dualize } from './_dualize.ts';

/**
 * Rhombic Triacontahedron: dual of the Icosidodecahedron.
 * 30 golden rhombic faces, 32 vertices.
 */
export class RhombicTriacontahedron extends Solid {
  protected readonly _faces: Face[] = normalizeFaces(dualize(new Icosidodecahedron().faces()), 1);
}
