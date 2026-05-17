import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformPyramid } from './_pyramid.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Pentagonal Pyramid (J2). 6 faces: 1 pentagon + 5 equilateral triangles.
 * 6 vertices, 10 edges.
 */
export class PentagonalPyramid implements Polyhedron {
  private _faces = normalizeFaces(uniformPyramid(5), 1);

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
