import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformElongatedBipyramid } from './_elongated_bipyramid.ts';

/**
 * Elongated Triangular Bipyramid (J14). Two J12 triangular bipyramid halves
 * (= regular tetrahedron caps) separated by a triangular prism.
 * 9 faces: 6 triangles + 3 squares. 8 vertices, 15 edges.
 */
export class ElongatedTriangularBipyramid extends Solid {
  protected readonly _faces = normalizeFaces(uniformElongatedBipyramid(3), 1);
}
