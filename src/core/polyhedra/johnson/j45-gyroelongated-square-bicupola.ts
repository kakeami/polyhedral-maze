import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformGyroelongatedBicupola } from './_stack.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Gyroelongated Square Bicupola (J45). Two square cupolae joined to an
 * octagonal antiprism. 34 faces: 24 △ + 10 □.
 */
export class GyroelongatedSquareBicupola implements Polyhedron {
  private _faces = normalizeFaces(uniformGyroelongatedBicupola(4), 1);

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
