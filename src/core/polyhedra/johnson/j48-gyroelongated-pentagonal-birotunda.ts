import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformGyroelongatedBirotunda } from './_stack.ts';

/**
 * Gyroelongated Pentagonal Birotunda (J48). Two pentagonal rotundas joined by
 * a decagonal antiprism. 52 faces: 30 △ + 10 □ + 12 ⬠.
 */
export class GyroelongatedPentagonalBirotunda extends Solid {
  protected readonly _faces = normalizeFaces(uniformGyroelongatedBirotunda(), 1);
}
