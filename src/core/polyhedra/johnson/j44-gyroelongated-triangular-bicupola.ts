import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformGyroelongatedBicupola } from './_stack.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Gyroelongated Triangular Bicupola (J44). Two triangular cupolae joined to a
 * hexagonal antiprism. 26 faces: 20 △ + 6 □.
 */
export class GyroelongatedTriangularBicupola implements Polyhedron {
  private _faces = normalizeFaces(uniformGyroelongatedBicupola(3), 1);

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
