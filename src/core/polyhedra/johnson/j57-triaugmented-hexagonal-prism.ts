import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformPrism } from '../prismatic/_uniform_prism.ts';
import { augmentFaces } from './_augment.ts';

/**
 * Triaugmented Hexagonal Prism (J57). Hexagonal prism with square pyramids
 * (J1) attached to three alternating square faces (every other one).
 * 17 faces (12 triangles + 3 squares + 2 hexagons), 15 vertices, 30 edges.
 */
export class TriaugmentedHexagonalPrism extends Solid {
  // Lateral squares in uniformPrism(6) are face ids 2..7. Faces 2, 4, 6 are
  // the alternating triplet.
  protected readonly _faces = normalizeFaces(
    augmentFaces(uniformPrism(6), [2, 4, 6], 'pyramid'),
    1,
  );
}
