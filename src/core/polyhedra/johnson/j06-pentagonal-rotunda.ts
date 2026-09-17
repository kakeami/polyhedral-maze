import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformRotunda } from './_rotunda.ts';

/**
 * Pentagonal Rotunda (J6). 17 faces: 1 decagon (bottom) + 1 pentagon (top) +
 * 5 mid pentagons + 5 upper triangles + 5 lower triangles. 20 vertices,
 * 35 edges. Equals the top half of an icosidodecahedron.
 */
export class PentagonalRotunda extends Solid {
  protected readonly _faces = normalizeFaces(uniformRotunda(), 1);
}
