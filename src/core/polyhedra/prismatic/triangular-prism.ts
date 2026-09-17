import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformPrism } from './_uniform_prism.ts';

/**
 * Triangular Prism (uniform, n=3). 5 faces: 2 equilateral triangles + 3
 * squares. 6 vertices, 9 edges. D_3h symmetry, no central inversion → no
 * antipodal face pairs.
 */
export class TriangularPrism extends Solid {
  protected readonly _faces = normalizeFaces(uniformPrism(3), 1);
}
