import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformPrism } from '../prismatic/_uniform_prism.ts';
import { augmentFaces } from './_augment.ts';

/**
 * Biaugmented Pentagonal Prism (J53). Pentagonal prism with square pyramids
 * (J1) attached to two non-adjacent square faces (separated by one
 * un-augmented square). 13 faces (8 triangles + 3 squares + 2 pentagons),
 * 12 vertices, 23 edges.
 */
export class BiaugmentedPentagonalPrism extends Solid {
  // Lateral squares in uniformPrism(5) are face ids 2..6 around the ring.
  // Picking face 2 and face 4 leaves face 3 (one square between them).
  protected readonly _faces = normalizeFaces(
    augmentFaces(uniformPrism(5), [2, 4], 'pyramid'),
    1,
  );
}
