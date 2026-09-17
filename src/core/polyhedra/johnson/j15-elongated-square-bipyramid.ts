import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformElongatedBipyramid } from './_elongated_bipyramid.ts';

/**
 * Elongated Square Bipyramid (J15). Octahedron split along a square equator
 * with a cube inserted. 12 faces: 8 triangles + 4 squares. 10 vertices,
 * 20 edges.
 */
export class ElongatedSquareBipyramid extends Solid {
  protected readonly _faces = normalizeFaces(uniformElongatedBipyramid(4), 1);
}
