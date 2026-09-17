import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformGyroelongatedBicupola } from './_stack.ts';

/**
 * Gyroelongated Pentagonal Bicupola (J46). Two pentagonal cupolae joined to a
 * decagonal antiprism. 42 faces: 30 △ + 10 □ + 2 ⬠.
 */
export class GyroelongatedPentagonalBicupola extends Solid {
  protected readonly _faces = normalizeFaces(uniformGyroelongatedBicupola(5), 1);
}
