import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformCupola } from './_cupola.ts';

/**
 * Pentagonal Cupola (J5). 12 faces: 1 decagon (bottom) + 1 pentagon (top) +
 * 5 lateral triangles + 5 lateral squares. 15 vertices, 25 edges.
 */
export class PentagonalCupola extends Solid {
  protected readonly _faces = normalizeFaces(uniformCupola(5), 1);
}
