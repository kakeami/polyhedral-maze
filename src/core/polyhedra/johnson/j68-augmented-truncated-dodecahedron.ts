import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { TruncatedDodecahedron } from '../archimedean/truncated-dodecahedron.ts';
import { augmentWithCupola } from './_augment.ts';

function buildFaces() {
  const base = new TruncatedDodecahedron().faces();
  const dec = base.find((f) => f.vertices.length === 10);
  if (!dec) throw new Error('J68: decagonal face not found');
  return augmentWithCupola(base, dec.id);
}

/**
 * Augmented Truncated Dodecahedron (J68). Truncated dodecahedron with a
 * pentagonal cupola (J5) attached to one of its 12 decagonal faces.
 * 42 faces (25 triangles + 5 squares + 1 pentagon + 11 decagons),
 * 65 vertices, 105 edges.
 */
export class AugmentedTruncatedDodecahedron extends Solid {
  protected readonly _faces = normalizeFaces(buildFaces(), 1);
}
