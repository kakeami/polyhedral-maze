import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { KiteGrid } from '../grids/kite-grid.ts';
import { compactTrapezohedron } from './_compact_trapezohedron.ts';

/**
 * Hexagonal Trapezohedron (n=6) with aspect ratio H/r = 1.
 * 12 kite faces, 14 vertices, 24 edges. D_6d has no central inversion (n is
 * even) — only the two apex faces pair up as antipodes? Actually no: the
 * 2n equator kites are arranged radially, antipodes determined empirically.
 */
export class HexagonalTrapezohedron implements Polyhedron {
  private _faces = normalizeFaces(compactTrapezohedron(6), 1);

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
