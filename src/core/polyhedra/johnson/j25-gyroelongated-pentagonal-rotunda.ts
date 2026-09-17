import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformRotunda } from './_rotunda.ts';
import { gyroelongate } from './_gyroelongate.ts';

/**
 * Gyroelongated Pentagonal Rotunda (J25). J6 stacked on a decagonal antiprism.
 * 37 faces: 30 triangles + 6 pentagons + 1 decagon. 30 vertices, 65 edges.
 */
export class GyroelongatedPentagonalRotunda extends Solid {
  protected readonly _faces = normalizeFaces(gyroelongate(uniformRotunda(), 1), 1);
}
