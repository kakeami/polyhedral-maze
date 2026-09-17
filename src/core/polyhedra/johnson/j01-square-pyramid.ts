import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformPyramid } from './_pyramid.ts';

/**
 * Square Pyramid (J1). 5 faces: 1 square + 4 equilateral triangles.
 * 5 vertices, 8 edges.
 */
export class SquarePyramid extends Solid {
  protected readonly _faces = normalizeFaces(uniformPyramid(4), 1);
}
