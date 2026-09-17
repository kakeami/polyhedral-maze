import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformAntiprism } from './_uniform_antiprism.ts';

/**
 * Hexagonal Antiprism (uniform, n=6). 14 faces: 2 hexagons + 12 triangles.
 * 12 vertices, 24 edges. D_6d has no σ_h and no inversion → no antipodes
 * apart from the top/bot hexagons.
 */
export class HexagonalAntiprism extends Solid {
  protected readonly _faces = normalizeFaces(uniformAntiprism(6), 1);
}
