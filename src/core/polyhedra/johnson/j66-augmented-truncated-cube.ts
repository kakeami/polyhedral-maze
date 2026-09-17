import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { TruncatedCube } from '../archimedean/truncated-cube.ts';
import { augmentWithCupola } from './_augment.ts';

function buildFaces() {
  const base = new TruncatedCube().faces();
  const oct = base.find((f) => f.vertices.length === 8);
  if (!oct) throw new Error('J66: octagonal face not found');
  return augmentWithCupola(base, oct.id);
}

/**
 * Augmented Truncated Cube (J66). Truncated cube with a square cupola (J4)
 * attached to one of its 6 octagonal faces. 22 faces (12 triangles +
 * 5 squares + 5 octagons), 28 vertices, 48 edges.
 */
export class AugmentedTruncatedCube extends Solid {
  protected readonly _faces = normalizeFaces(buildFaces(), 1);
}
