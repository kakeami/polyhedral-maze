import type { Face } from '../../types.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { TruncatedCuboctahedron } from '../archimedean/truncated-cuboctahedron.ts';
import { dualize } from './_dualize.ts';

/**
 * Disdyakis Dodecahedron: dual of the Truncated Cuboctahedron.
 * 48 scalene triangular faces, 26 vertices.
 */
export class DisdyakisDodecahedron extends Solid {
  protected readonly _faces: Face[] = normalizeFaces(dualize(new TruncatedCuboctahedron().faces()), 1);
}
