import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformElongatedCupolaRotunda } from './_stack.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Elongated Pentagonal Gyrocupolarotunda (J41). J33 with a decagonal prism.
 * 37 faces: 15 △ + 15 □ + 7 ⬠.
 */
export class ElongatedPentagonalGyrocupolarotunda implements Polyhedron {
  private _faces = normalizeFaces(uniformElongatedCupolaRotunda('gyro'), 1);

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
