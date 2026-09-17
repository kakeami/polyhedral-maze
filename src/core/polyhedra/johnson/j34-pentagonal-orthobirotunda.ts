import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformBirotunda } from './_stack.ts';

/**
 * Pentagonal Orthobirotunda (J34). 32 faces: 20 △ + 12 ⬠. 30 vertices,
 * 60 edges. The gyro variant is the Icosidodecahedron (Archimedean, excluded
 * from Johnson).
 */
export class PentagonalOrthobirotunda extends Solid {
  protected readonly _faces = normalizeFaces(uniformBirotunda(), 1);
}
