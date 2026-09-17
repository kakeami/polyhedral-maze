import type { Face } from '../../types.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { TruncatedOctahedron } from '../archimedean/truncated-octahedron.ts';
import { dualize } from './_dualize.ts';

/**
 * Tetrakis Hexahedron: dual of the Truncated Octahedron.
 * 24 isoceles triangular faces, 14 vertices.
 */
export class TetrakisHexahedron extends Solid {
  protected readonly _faces: Face[] = normalizeFaces(dualize(new TruncatedOctahedron().faces()), 1);
}
