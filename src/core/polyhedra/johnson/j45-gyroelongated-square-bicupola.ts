import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformGyroelongatedBicupola } from './_stack.ts';

/**
 * Gyroelongated Square Bicupola (J45). Two square cupolae joined to an
 * octagonal antiprism. 34 faces: 24 △ + 10 □.
 */
export class GyroelongatedSquareBicupola extends Solid {
  protected readonly _faces = normalizeFaces(uniformGyroelongatedBicupola(4), 1);
}
