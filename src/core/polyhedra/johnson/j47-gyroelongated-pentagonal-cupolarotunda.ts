import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformGyroelongatedCupolaRotunda } from './_stack.ts';

/**
 * Gyroelongated Pentagonal Cupolarotunda (J47). Pentagonal cupola + decagonal
 * antiprism + pentagonal rotunda. 47 faces: 25 △ + 15 □ + 7 ⬠.
 */
export class GyroelongatedPentagonalCupolarotunda extends Solid {
  protected readonly _faces = normalizeFaces(uniformGyroelongatedCupolaRotunda(), 1);
}
