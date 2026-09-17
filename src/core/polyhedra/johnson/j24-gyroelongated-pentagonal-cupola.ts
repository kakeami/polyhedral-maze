import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformCupola } from './_cupola.ts';
import { gyroelongate } from './_gyroelongate.ts';

/**
 * Gyroelongated Pentagonal Cupola (J24). J5 stacked on a decagonal antiprism.
 * 32 faces: 25 triangles + 5 squares + 1 pentagon + 1 decagon. 25 vertices,
 * 55 edges.
 */
export class GyroelongatedPentagonalCupola extends Solid {
  protected readonly _faces = normalizeFaces(gyroelongate(uniformCupola(5), 1), 1);
}
