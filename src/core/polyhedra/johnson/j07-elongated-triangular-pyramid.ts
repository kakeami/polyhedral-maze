import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformPyramid } from './_pyramid.ts';
import { elongate } from './_elongate.ts';

/**
 * Elongated Triangular Pyramid (J7). Tetrahedron stacked on a triangular
 * prism. 7 faces: 4 triangles (3 lateral + 1 prism bottom) + 3 squares.
 * 7 vertices, 12 edges.
 */
export class ElongatedTriangularPyramid extends Solid {
  protected readonly _faces = normalizeFaces(elongate(uniformPyramid(3), 0), 1);
}
