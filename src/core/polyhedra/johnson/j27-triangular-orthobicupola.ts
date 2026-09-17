import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformBicupola } from './_stack.ts';

/**
 * Triangular Orthobicupola (J27). 14 faces: 8 △ + 6 □. 12 vertices, 24 edges.
 * The gyro variant is the Cuboctahedron (Archimedean, excluded from Johnson).
 */
export class TriangularOrthobicupola extends Solid {
  protected readonly _faces = normalizeFaces(uniformBicupola(3, 'ortho'), 1);
}
