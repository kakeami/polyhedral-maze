import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformElongatedBicupola } from './_stack.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Elongated Pentagonal Gyrobicupola (J39). J31 with a decagonal prism band.
 * 32 faces: 10 △ + 20 □ + 2 ⬠.
 */
export class ElongatedPentagonalGyrobicupola implements Polyhedron {
  private _faces = normalizeFaces(uniformElongatedBicupola(5, 'gyro'), 1);

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
