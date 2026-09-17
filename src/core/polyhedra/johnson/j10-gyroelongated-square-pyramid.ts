import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformPyramid } from './_pyramid.ts';
import { gyroelongate } from './_gyroelongate.ts';

/**
 * Gyroelongated Square Pyramid (J10). Square pyramid (J1) stacked on a
 * square antiprism. 13 faces: 12 triangles + 1 square. 9 vertices, 20 edges.
 */
export class GyroelongatedSquarePyramid extends Solid {
  protected readonly _faces = normalizeFaces(gyroelongate(uniformPyramid(4), 0), 1);
}
