import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { TriGrid } from '../grids/tri-grid.ts';
import { compactBipyramid } from './_compact_bipyramid.ts';

/**
 * Hexagonal Bipyramid (n=6) with aspect ratio h/r = 1.
 * 12 isosceles-triangle faces, 8 vertices, 18 edges. D_6h has central
 * inversion → every face has an antipode.
 */
export class HexagonalBipyramid implements Polyhedron {
  private _faces = normalizeFaces(compactBipyramid(6), 1);

  faces(): Face[] {
    return [...this._faces];
  }

  faceAdjacency(): Graph<string, Record<string, unknown>, FaceEdgeData> {
    return buildFaceAdjacency(this._faces, sharedEdgeVertices);
  }

  gridForFace(face: Face, n: number): FaceGrid {
    return new TriGrid(face, n);
  }
}
