import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformGyroelongatedCupolaRotunda } from './_stack.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Gyroelongated Pentagonal Cupolarotunda (J47). Pentagonal cupola + decagonal
 * antiprism + pentagonal rotunda. 47 faces: 25 △ + 15 □ + 7 ⬠.
 */
export class GyroelongatedPentagonalCupolarotunda implements Polyhedron {
  private _faces = normalizeFaces(uniformGyroelongatedCupolaRotunda(), 1);

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
