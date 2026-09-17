import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformCupola } from './_cupola.ts';

/**
 * Square Cupola (J4). 10 faces: 1 octagon (bottom) + 1 square (top) +
 * 4 lateral triangles + 4 lateral squares. 12 vertices, 20 edges.
 */
export class SquareCupola extends Solid {
  protected readonly _faces = normalizeFaces(uniformCupola(4), 1);
}
