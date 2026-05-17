import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { KiteGrid } from '../grids/kite-grid.ts';
import { uniformTrapezohedron } from './_uniform_trapezohedron.ts';

/**
 * Octagonal Trapezohedron (n=8, dual of the octagonal antiprism).
 * 16 kite faces, 18 vertices, 32 edges. D_8d has no central inversion (n is
 * even).
 */
export class OctagonalTrapezohedron implements Polyhedron {
  private _faces = normalizeFaces(uniformTrapezohedron(8), 1);

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
