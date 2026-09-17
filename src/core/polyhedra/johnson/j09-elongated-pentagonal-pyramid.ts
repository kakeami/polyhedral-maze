import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformPyramid } from './_pyramid.ts';
import { elongate } from './_elongate.ts';

/**
 * Elongated Pentagonal Pyramid (J9). Pentagonal pyramid (J2) stacked on a
 * pentagonal prism. 11 faces: 5 triangles + 5 squares + 1 pentagon
 * (prism bottom). 11 vertices, 20 edges.
 */
export class ElongatedPentagonalPyramid extends Solid {
  protected readonly _faces = normalizeFaces(elongate(uniformPyramid(5), 0), 1);
}
