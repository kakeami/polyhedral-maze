import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformAntiprism } from './_uniform_antiprism.ts';

/**
 * Pentagonal Antiprism (uniform, n=5). 12 faces: 2 pentagons + 10 triangles.
 * 10 vertices, 20 edges. D_5d has central inversion → every face has an
 * antipode.
 */
export class PentagonalAntiprism extends Solid {
  protected readonly _faces = normalizeFaces(uniformAntiprism(5), 1);
}
