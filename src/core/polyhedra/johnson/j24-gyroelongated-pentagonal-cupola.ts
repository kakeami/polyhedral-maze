import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformCupola } from './_cupola.ts';
import { gyroelongate } from './_gyroelongate.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Gyroelongated Pentagonal Cupola (J24). J5 stacked on a decagonal antiprism.
 * 32 faces: 25 triangles + 5 squares + 1 pentagon + 1 decagon. 25 vertices,
 * 55 edges.
 */
export class GyroelongatedPentagonalCupola implements Polyhedron {
  private _faces = normalizeFaces(gyroelongate(uniformCupola(5), 1), 1);

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
