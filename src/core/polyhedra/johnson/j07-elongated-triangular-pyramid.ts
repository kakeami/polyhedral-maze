import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformPyramid } from './_pyramid.ts';
import { elongate } from './_elongate.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Elongated Triangular Pyramid (J7). Tetrahedron stacked on a triangular
 * prism. 7 faces: 4 triangles (3 lateral + 1 prism bottom) + 3 squares.
 * 7 vertices, 12 edges.
 */
export class ElongatedTriangularPyramid implements Polyhedron {
  private _faces = normalizeFaces(elongate(uniformPyramid(3), 0), 1);

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
