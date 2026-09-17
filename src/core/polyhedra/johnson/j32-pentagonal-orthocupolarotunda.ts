import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformCupolaRotunda } from './_stack.ts';

/**
 * Pentagonal Orthocupolarotunda (J32). 27 faces: 15 △ + 5 □ + 7 ⬠.
 * 25 vertices, 50 edges.
 */
export class PentagonalOrthocupolarotunda extends Solid {
  protected readonly _faces = normalizeFaces(uniformCupolaRotunda('ortho'), 1);
}
