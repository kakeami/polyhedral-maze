import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformPrism } from './_uniform_prism.ts';

/**
 * Octagonal Prism (uniform, n=8). 10 faces: 2 octagons + 8 squares.
 * 16 vertices, 24 edges. D_8h has central inversion.
 */
export class OctagonalPrism extends Solid {
  protected readonly _faces = normalizeFaces(uniformPrism(8), 1);
}
