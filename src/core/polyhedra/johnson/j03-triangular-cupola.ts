import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformCupola } from './_cupola.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Triangular Cupola (J3). 8 faces: 1 hexagon (bottom) + 1 triangle (top) +
 * 3 lateral triangles + 3 lateral squares. 9 vertices, 15 edges.
 */
export class TriangularCupola implements Polyhedron {
  private _faces = normalizeFaces(uniformCupola(3), 1);

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
