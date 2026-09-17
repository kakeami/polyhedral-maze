import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformPrism } from '../prismatic/_uniform_prism.ts';
import { augmentWithPyramid } from './_augment.ts';

/**
 * Augmented Pentagonal Prism (J52). Pentagonal prism with a square pyramid
 * (J1) attached to one of its five square faces. 10 faces
 * (4 triangles + 4 squares + 2 pentagons), 11 vertices, 19 edges.
 */
export class AugmentedPentagonalPrism extends Solid {
  protected readonly _faces = normalizeFaces(
    augmentWithPyramid(uniformPrism(5), 2),
    1,
  );
}
