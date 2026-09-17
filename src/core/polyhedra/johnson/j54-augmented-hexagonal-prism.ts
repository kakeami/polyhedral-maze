import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformPrism } from '../prismatic/_uniform_prism.ts';
import { augmentWithPyramid } from './_augment.ts';

/**
 * Augmented Hexagonal Prism (J54). Hexagonal prism with a square pyramid
 * (J1) attached to one of its six square faces. 11 faces
 * (4 triangles + 5 squares + 2 hexagons), 13 vertices, 22 edges.
 */
export class AugmentedHexagonalPrism extends Solid {
  protected readonly _faces = normalizeFaces(
    augmentWithPyramid(uniformPrism(6), 2),
    1,
  );
}
