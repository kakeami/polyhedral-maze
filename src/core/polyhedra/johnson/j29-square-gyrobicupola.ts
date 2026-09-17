import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformBicupola } from './_stack.ts';

/**
 * Square Gyrobicupola (J29). 18 faces: 8 △ + 10 □. 16 vertices, 32 edges.
 */
export class SquareGyrobicupola extends Solid {
  protected readonly _faces = normalizeFaces(uniformBicupola(4, 'gyro'), 1);
}
