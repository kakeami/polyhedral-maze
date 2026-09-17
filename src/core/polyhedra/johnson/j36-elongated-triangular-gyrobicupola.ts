import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformElongatedBicupola } from './_stack.ts';

/**
 * Elongated Triangular Gyrobicupola (J36). Cuboctahedron-derived: two
 * triangular cupolae rotated by π/3 relative to each other, separated by a
 * hexagonal prism. 20 faces: 8 △ + 12 □.
 */
export class ElongatedTriangularGyrobicupola extends Solid {
  protected readonly _faces = normalizeFaces(uniformElongatedBicupola(3, 'gyro'), 1);
}
