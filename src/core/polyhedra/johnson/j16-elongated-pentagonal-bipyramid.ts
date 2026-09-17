import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformElongatedBipyramid } from './_elongated_bipyramid.ts';

/**
 * Elongated Pentagonal Bipyramid (J16). J13 pentagonal bipyramid split along
 * its pentagonal equator with a pentagonal prism inserted. 15 faces: 10
 * triangles + 5 squares. 12 vertices, 25 edges.
 */
export class ElongatedPentagonalBipyramid extends Solid {
  protected readonly _faces = normalizeFaces(uniformElongatedBipyramid(5), 1);
}
