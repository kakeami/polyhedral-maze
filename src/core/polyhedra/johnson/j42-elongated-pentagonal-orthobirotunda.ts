import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformElongatedBirotunda } from './_stack.ts';

/**
 * Elongated Pentagonal Orthobirotunda (J42). J34 with a decagonal prism.
 * 42 faces: 20 △ + 10 □ + 12 ⬠.
 */
export class ElongatedPentagonalOrthobirotunda extends Solid {
  protected readonly _faces = normalizeFaces(uniformElongatedBirotunda('ortho'), 1);
}
