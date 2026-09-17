import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { TruncatedTetrahedron } from '../archimedean/truncated-tetrahedron.ts';
import { augmentWithCupola } from './_augment.ts';

function buildFaces() {
  const base = new TruncatedTetrahedron().faces();
  const hex = base.find((f) => f.vertices.length === 6);
  if (!hex) throw new Error('J65: hexagonal face not found');
  return augmentWithCupola(base, hex.id);
}

/**
 * Augmented Truncated Tetrahedron (J65). Truncated tetrahedron with a
 * triangular cupola (J3) attached to one of its 4 hexagonal faces.
 * 14 faces (8 triangles + 3 squares + 3 hexagons), 15 vertices, 27 edges.
 */
export class AugmentedTruncatedTetrahedron extends Solid {
  protected readonly _faces = normalizeFaces(buildFaces(), 1);
}
