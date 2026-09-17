import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformCupola } from './_cupola.ts';
import { gyroelongate } from './_gyroelongate.ts';

/**
 * Gyroelongated Square Cupola (J23). J4 stacked on an octagonal antiprism.
 * 26 faces: 20 triangles + 5 squares + 1 octagon. 20 vertices, 44 edges.
 */
export class GyroelongatedSquareCupola extends Solid {
  protected readonly _faces = normalizeFaces(gyroelongate(uniformCupola(4), 1), 1);
}
