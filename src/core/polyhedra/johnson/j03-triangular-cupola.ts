import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformCupola } from './_cupola.ts';

/**
 * Triangular Cupola (J3). 8 faces: 1 hexagon (bottom) + 1 triangle (top) +
 * 3 lateral triangles + 3 lateral squares. 9 vertices, 15 edges.
 */
export class TriangularCupola extends Solid {
  protected readonly _faces = normalizeFaces(uniformCupola(3), 1);
}
