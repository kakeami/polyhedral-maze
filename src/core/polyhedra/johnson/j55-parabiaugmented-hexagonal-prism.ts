import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformPrism } from '../prismatic/_uniform_prism.ts';
import { augmentFaces } from './_augment.ts';

/**
 * Parabiaugmented Hexagonal Prism (J55). Hexagonal prism with square pyramids
 * (J1) attached to two opposite square faces (180° apart in the ring).
 * 14 faces (8 triangles + 4 squares + 2 hexagons), 14 vertices, 26 edges.
 */
export class ParabiaugmentedHexagonalPrism extends Solid {
  // Lateral squares in uniformPrism(6) are face ids 2..7. Faces 2 and 5 are
  // diametrically opposite (3 apart in the cyclic ring of 6).
  protected readonly _faces = normalizeFaces(
    augmentFaces(uniformPrism(6), [2, 5], 'pyramid'),
    1,
  );
}
