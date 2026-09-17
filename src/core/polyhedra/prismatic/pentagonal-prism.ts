import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformPrism } from './_uniform_prism.ts';

/**
 * Pentagonal Prism (uniform, n=5). 7 faces: 2 pentagons + 5 squares.
 * 10 vertices, 15 edges. D_5h, no central inversion.
 */
export class PentagonalPrism extends Solid {
  protected readonly _faces = normalizeFaces(uniformPrism(5), 1);
}
