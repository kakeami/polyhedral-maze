import type { Face } from '../../types.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { TruncatedDodecahedron } from '../archimedean/truncated-dodecahedron.ts';
import { dualize } from './_dualize.ts';

/**
 * Triakis Icosahedron: dual of the Truncated Dodecahedron.
 * 60 isoceles triangular faces, 32 vertices.
 */
export class TriakisIcosahedron extends Solid {
  protected readonly _faces: Face[] = normalizeFaces(dualize(new TruncatedDodecahedron().faces()), 1);
}
