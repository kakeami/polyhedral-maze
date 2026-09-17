import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformElongatedCupolaRotunda } from './_stack.ts';

/**
 * Elongated Pentagonal Orthocupolarotunda (J40). J32 with a decagonal prism.
 * 37 faces: 15 △ + 15 □ + 7 ⬠.
 */
export class ElongatedPentagonalOrthocupolarotunda extends Solid {
  protected readonly _faces = normalizeFaces(uniformElongatedCupolaRotunda('ortho'), 1);
}
