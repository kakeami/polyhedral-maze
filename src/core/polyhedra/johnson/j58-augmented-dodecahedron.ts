import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { Dodecahedron } from '../platonic/dodecahedron.ts';
import { augmentWithPyramid } from './_augment.ts';

/**
 * Augmented Dodecahedron (J58). Dodecahedron with a pentagonal pyramid (J2)
 * attached to one of its 12 pentagonal faces. 16 faces (5 triangles +
 * 11 pentagons), 21 vertices, 35 edges.
 */
export class AugmentedDodecahedron extends Solid {
  protected readonly _faces = normalizeFaces(
    augmentWithPyramid(new Dodecahedron().faces(), 0),
    1,
  );
}
