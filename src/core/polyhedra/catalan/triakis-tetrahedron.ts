import type { Face } from '../../types.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { TruncatedTetrahedron } from '../archimedean/truncated-tetrahedron.ts';
import { dualize } from './_dualize.ts';

/**
 * Triakis Tetrahedron: dual of the Truncated Tetrahedron.
 * 12 isoceles triangular faces, 8 vertices.
 */
export class TriakisTetrahedron extends Solid {
  protected readonly _faces: Face[] = normalizeFaces(dualize(new TruncatedTetrahedron().faces()), 1);
}
