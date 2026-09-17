import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformAntiprism } from './_uniform_antiprism.ts';

/**
 * Decagonal Antiprism (uniform, n=10). 22 faces: 2 decagons + 20 triangles.
 * 20 vertices, 40 edges. D_10d, no central inversion (n even).
 */
export class DecagonalAntiprism extends Solid {
  protected readonly _faces = normalizeFaces(uniformAntiprism(10), 1);
}
