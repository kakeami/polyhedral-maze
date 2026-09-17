import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformPyramid } from './_pyramid.ts';
import { gyroelongate } from './_gyroelongate.ts';

/**
 * Gyroelongated Pentagonal Pyramid (J11). Pentagonal pyramid (J2) stacked on
 * a pentagonal antiprism. 16 faces: 15 triangles + 1 pentagon. 11 vertices,
 * 25 edges.
 */
export class GyroelongatedPentagonalPyramid extends Solid {
  protected readonly _faces = normalizeFaces(gyroelongate(uniformPyramid(5), 0), 1);
}
