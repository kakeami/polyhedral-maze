import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformAntiprism } from './_uniform_antiprism.ts';

/**
 * Square Antiprism (uniform, n=4). 10 faces: 2 squares + 8 triangles.
 * 8 vertices, 16 edges. D_4d, no central inversion.
 */
export class SquareAntiprism extends Solid {
  protected readonly _faces = normalizeFaces(uniformAntiprism(4), 1);
}
