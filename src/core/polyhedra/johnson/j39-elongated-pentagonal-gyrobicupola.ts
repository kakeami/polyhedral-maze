import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformElongatedBicupola } from './_stack.ts';

/**
 * Elongated Pentagonal Gyrobicupola (J39). J31 with a decagonal prism band.
 * 32 faces: 10 △ + 20 □ + 2 ⬠.
 */
export class ElongatedPentagonalGyrobicupola extends Solid {
  protected readonly _faces = normalizeFaces(uniformElongatedBicupola(5, 'gyro'), 1);
}
