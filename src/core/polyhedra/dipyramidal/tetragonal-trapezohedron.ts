import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { KiteGrid } from '../grids/kite-grid.ts';
import { uniformTrapezohedron } from './_uniform_trapezohedron.ts';

/**
 * Tetragonal Trapezohedron (n=4, dual of the square antiprism).
 * 8 kite faces, 10 vertices, 16 edges. D_4d has no central inversion (only
 * the top/bottom apex pair as antipodes).
 */
export class TetragonalTrapezohedron implements Polyhedron {
  private _faces = normalizeFaces(uniformTrapezohedron(4), 1);

  faces(): Face[] {
    return [...this._faces];
  }

  faceAdjacency(): Graph<string, Record<string, unknown>, FaceEdgeData> {
    return buildFaceAdjacency(this._faces, sharedEdgeVertices);
  }

  gridForFace(face: Face, n: number): FaceGrid {
    return new KiteGrid(face, n);
  }
}
