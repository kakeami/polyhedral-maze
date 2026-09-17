import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformPrism } from '../prismatic/_uniform_prism.ts';
import { augmentWithPyramid } from './_augment.ts';

/**
 * Augmented Triangular Prism (J49). Triangular prism with a square pyramid
 * (J1) attached to one of its three square faces. 8 faces (6 triangles +
 * 2 squares), 7 vertices, 13 edges.
 */
export class AugmentedTriangularPrism extends Solid {
  protected readonly _faces = normalizeFaces(
    augmentWithPyramid(uniformPrism(3), 2),
    1,
  );
}
