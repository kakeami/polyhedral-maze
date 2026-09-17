import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformElongatedCupolaRotunda } from './_stack.ts';

/**
 * Elongated Pentagonal Gyrocupolarotunda (J41). J33 with a decagonal prism.
 * 37 faces: 15 △ + 15 □ + 7 ⬠.
 */
export class ElongatedPentagonalGyrocupolarotunda extends Solid {
  protected readonly _faces = normalizeFaces(uniformElongatedCupolaRotunda('gyro'), 1);
}
