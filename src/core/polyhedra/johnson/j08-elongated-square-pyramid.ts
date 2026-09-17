import { Solid } from '../_solid.ts';
import { normalizeFaces } from '../../polyhedron.ts';
import { uniformPyramid } from './_pyramid.ts';
import { elongate } from './_elongate.ts';

/**
 * Elongated Square Pyramid (J8). Square pyramid (J1) stacked on a cube.
 * 9 faces: 4 triangles + 5 squares (4 lateral + 1 bottom). 9 vertices,
 * 16 edges.
 */
export class ElongatedSquarePyramid extends Solid {
  protected readonly _faces = normalizeFaces(elongate(uniformPyramid(4), 0), 1);
}
