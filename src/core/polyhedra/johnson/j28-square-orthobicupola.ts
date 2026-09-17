import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformBicupola } from './_stack.ts';

/**
 * Square Orthobicupola (J28). 18 faces: 8 △ + 10 □. 16 vertices, 32 edges.
 */
export class SquareOrthobicupola extends Solid {
  protected readonly _faces = normalizeFaces(uniformBicupola(4, 'ortho'), 1);
}
