import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformElongatedBicupola } from './_stack.ts';

/**
 * Elongated Triangular Orthobicupola (J35). J27 with a hexagonal prism band
 * inserted at the equator. 20 faces: 8 △ + 12 □.
 */
export class ElongatedTriangularOrthobicupola extends Solid {
  protected readonly _faces = normalizeFaces(uniformElongatedBicupola(3, 'ortho'), 1);
}
