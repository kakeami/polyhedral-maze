import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformCupola } from './_cupola.ts';
import { gyroelongate } from './_gyroelongate.ts';

/**
 * Gyroelongated Triangular Cupola (J22). J3 stacked on a hexagonal antiprism.
 * 20 faces: 16 triangles + 3 squares + 1 hexagon. 15 vertices, 33 edges.
 */
export class GyroelongatedTriangularCupola extends Solid {
  protected readonly _faces = normalizeFaces(gyroelongate(uniformCupola(3), 1), 1);
}
