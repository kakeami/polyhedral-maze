import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformPyramid } from './_pyramid.ts';
import { elongate } from './_elongate.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Elongated Square Pyramid (J8). Square pyramid (J1) stacked on a cube.
 * 9 faces: 4 triangles + 5 squares (4 lateral + 1 bottom). 9 vertices,
 * 16 edges.
 */
export class ElongatedSquarePyramid implements Polyhedron {
  private _faces = normalizeFaces(elongate(uniformPyramid(4), 0), 1);

  faces(): Face[] {
    return [...this._faces];
  }

  faceAdjacency(): Graph<string, Record<string, unknown>, FaceEdgeData> {
    return buildFaceAdjacency(this._faces, sharedEdgeVertices);
  }

  gridForFace(face: Face, n: number): FaceGrid {
    return gridForPolygonFace(face, n);
  }
}
