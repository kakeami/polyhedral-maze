import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformPyramid } from './_pyramid.ts';

/**
 * Pentagonal Pyramid (J2). 6 faces: 1 pentagon + 5 equilateral triangles.
 * 6 vertices, 10 edges.
 */
export class PentagonalPyramid extends Solid {
  protected readonly _faces = normalizeFaces(uniformPyramid(5), 1);
}
