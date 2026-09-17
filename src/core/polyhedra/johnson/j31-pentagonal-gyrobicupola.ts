import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformBicupola } from './_stack.ts';

/**
 * Pentagonal Gyrobicupola (J31). 22 faces: 10 △ + 10 □ + 2 ⬠. 20 vertices,
 * 40 edges.
 */
export class PentagonalGyrobicupola extends Solid {
  protected readonly _faces = normalizeFaces(uniformBicupola(5, 'gyro'), 1);
}
