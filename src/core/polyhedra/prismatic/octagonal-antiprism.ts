import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformAntiprism } from './_uniform_antiprism.ts';

/**
 * Octagonal Antiprism (uniform, n=8). 18 faces: 2 octagons + 16 triangles.
 * 16 vertices, 32 edges. D_8d, no central inversion (n even).
 */
export class OctagonalAntiprism extends Solid {
  protected readonly _faces = normalizeFaces(uniformAntiprism(8), 1);
}
