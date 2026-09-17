import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformPrism } from '../prismatic/_uniform_prism.ts';
import { augmentFaces } from './_augment.ts';

/**
 * Metabiaugmented Hexagonal Prism (J56). Hexagonal prism with square pyramids
 * (J1) attached to two square faces separated by one un-augmented square
 * (120° apart, "meta"). 14 faces (8 triangles + 4 squares + 2 hexagons),
 * 14 vertices, 26 edges.
 */
export class MetabiaugmentedHexagonalPrism extends Solid {
  // Lateral squares in uniformPrism(6) are face ids 2..7. Faces 2 and 4 sit
  // 2 apart in the cyclic ring of 6.
  protected readonly _faces = normalizeFaces(
    augmentFaces(uniformPrism(6), [2, 4], 'pyramid'),
    1,
  );
}
