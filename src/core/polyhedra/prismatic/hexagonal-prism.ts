import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformPrism } from './_uniform_prism.ts';

/**
 * Hexagonal Prism (uniform, n=6). 8 faces: 2 hexagons + 6 squares.
 * 12 vertices, 18 edges. D_6h has central inversion → every face has an
 * antipode.
 */
export class HexagonalPrism extends Solid {
  protected readonly _faces = normalizeFaces(uniformPrism(6), 1);
}
