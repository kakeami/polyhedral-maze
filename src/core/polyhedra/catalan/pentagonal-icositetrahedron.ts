import type { Face } from '../../types.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { SnubCube } from '../archimedean/snub-cube.ts';
import { dualize } from './_dualize.ts';

/**
 * Pentagonal Icositetrahedron: dual of the Snub Cube.
 * 24 chiral irregular pentagonal faces, 38 vertices.
 */
export class PentagonalIcositetrahedron extends Solid {
  protected readonly _faces: Face[] = normalizeFaces(dualize(new SnubCube().faces()), 1);
}
