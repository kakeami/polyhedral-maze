import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformElongatedBicupola } from './_stack.ts';

/**
 * Elongated Square Gyrobicupola (J37) — "pseudo-rhombicuboctahedron". J29 with
 * an octagonal prism inserted at the equator. 26 faces: 8 △ + 18 □.
 * The ortho variant of this construction is the Rhombicuboctahedron (Archimedean).
 */
export class ElongatedSquareGyrobicupola extends Solid {
  protected readonly _faces = normalizeFaces(uniformElongatedBicupola(4, 'gyro'), 1);
}
