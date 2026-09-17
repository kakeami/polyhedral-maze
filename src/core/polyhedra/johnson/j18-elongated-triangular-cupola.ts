import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformCupola } from './_cupola.ts';
import { elongate } from './_elongate.ts';

/**
 * Elongated Triangular Cupola (J18). J3 stacked on a hexagonal prism.
 * 14 faces: 4 triangles + 9 squares + 1 hexagon. 15 vertices, 27 edges.
 *
 * `uniformCupola(3)` places the hexagon at face id 1.
 */
export class ElongatedTriangularCupola extends Solid {
  protected readonly _faces = normalizeFaces(elongate(uniformCupola(3), 1), 1);
}
