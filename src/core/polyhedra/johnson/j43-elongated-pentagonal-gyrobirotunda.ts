import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformElongatedBirotunda } from './_stack.ts';

/**
 * Elongated Pentagonal Gyrobirotunda (J43). Two pentagonal rotundas with
 * matching azimuth would yield the Icosidodecahedron after gyroelongation —
 * instead this Johnson shape has rotundas rotated by π/5 and joined to a
 * decagonal prism. 42 faces: 20 △ + 10 □ + 12 ⬠.
 */
export class ElongatedPentagonalGyrobirotunda extends Solid {
  protected readonly _faces = normalizeFaces(uniformElongatedBirotunda('gyro'), 1);
}
