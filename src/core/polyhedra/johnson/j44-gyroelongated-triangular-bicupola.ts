import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformGyroelongatedBicupola } from './_stack.ts';

/**
 * Gyroelongated Triangular Bicupola (J44). Two triangular cupolae joined to a
 * hexagonal antiprism. 26 faces: 20 △ + 6 □.
 */
export class GyroelongatedTriangularBicupola extends Solid {
  protected readonly _faces = normalizeFaces(uniformGyroelongatedBicupola(3), 1);
}
