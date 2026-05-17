import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformCupola } from './_cupola.ts';
import { gyroelongate } from './_gyroelongate.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Gyroelongated Square Cupola (J23). J4 stacked on an octagonal antiprism.
 * 26 faces: 20 triangles + 5 squares + 1 octagon. 20 vertices, 44 edges.
 */
export class GyroelongatedSquareCupola implements Polyhedron {
  private _faces = normalizeFaces(gyroelongate(uniformCupola(4), 1), 1);

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
