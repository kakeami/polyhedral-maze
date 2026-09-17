import type { Face } from '../../types.ts';
import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { TruncatedIcosidodecahedron } from '../archimedean/truncated-icosidodecahedron.ts';
import { dualize } from './_dualize.ts';

/**
 * Disdyakis Triacontahedron: dual of the Truncated Icosidodecahedron.
 * 120 scalene triangular faces, 62 vertices.
 */
export class DisdyakisTriacontahedron extends Solid {
  protected readonly _faces: Face[] = normalizeFaces(dualize(new TruncatedIcosidodecahedron().faces()), 1);
}
