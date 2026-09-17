import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformPrism } from './_uniform_prism.ts';

/**
 * Decagonal Prism (uniform, n=10). 12 faces: 2 decagons + 10 squares.
 * 20 vertices, 30 edges. D_10h has central inversion.
 */
export class DecagonalPrism extends Solid {
  protected readonly _faces = normalizeFaces(uniformPrism(10), 1);
}
