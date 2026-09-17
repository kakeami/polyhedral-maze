import type { Face } from '../../types.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { SnubDodecahedron } from '../archimedean/snub-dodecahedron.ts';
import { dualize } from './_dualize.ts';

/**
 * Pentagonal Hexecontahedron: dual of the Snub Dodecahedron.
 * 60 chiral irregular pentagonal faces, 92 vertices.
 */
export class PentagonalHexecontahedron extends Solid {
  protected readonly _faces: Face[] = normalizeFaces(dualize(new SnubDodecahedron().faces()), 1);
}
