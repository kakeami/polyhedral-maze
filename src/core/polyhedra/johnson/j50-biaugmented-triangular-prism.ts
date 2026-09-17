import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformPrism } from '../prismatic/_uniform_prism.ts';
import { augmentFaces } from './_augment.ts';

/**
 * Biaugmented Triangular Prism (J50). Triangular prism with square pyramids
 * (J1) attached to two of its three square faces. The third square is left
 * bare; with all three augmented the shape becomes J51, a deltahedron.
 * 11 faces (10 triangles + 1 square), 8 vertices, 17 edges.
 */
export class BiaugmentedTriangularPrism extends Solid {
  protected readonly _faces = normalizeFaces(
    augmentFaces(uniformPrism(3), [2, 3], 'pyramid'),
    1,
  );
}
