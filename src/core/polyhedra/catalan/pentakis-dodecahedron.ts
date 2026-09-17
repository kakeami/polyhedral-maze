import type { Face } from '../../types.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { TruncatedIcosahedron } from '../archimedean/truncated-icosahedron.ts';
import { dualize } from './_dualize.ts';

/**
 * Pentakis Dodecahedron: dual of the Truncated Icosahedron.
 * 60 isoceles triangular faces, 32 vertices.
 */
export class PentakisDodecahedron extends Solid {
  protected readonly _faces: Face[] = normalizeFaces(dualize(new TruncatedIcosahedron().faces()), 1);
}
