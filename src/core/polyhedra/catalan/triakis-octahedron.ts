import type { Face } from '../../types.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { TruncatedCube } from '../archimedean/truncated-cube.ts';
import { dualize } from './_dualize.ts';

/**
 * Triakis Octahedron: dual of the Truncated Cube.
 * 24 isoceles triangular faces, 14 vertices.
 */
export class TriakisOctahedron extends Solid {
  protected readonly _faces: Face[] = normalizeFaces(dualize(new TruncatedCube().faces()), 1);
}
