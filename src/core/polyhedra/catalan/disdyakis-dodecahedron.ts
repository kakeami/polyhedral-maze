import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { TriGrid } from '../grids/tri-grid.ts';
import { TruncatedCuboctahedron } from '../archimedean/truncated-cuboctahedron.ts';
import { dualize } from './_dualize.ts';

/**
 * Disdyakis Dodecahedron: dual of the Truncated Cuboctahedron.
 * 48 scalene triangular faces, 26 vertices.
 */
export class DisdyakisDodecahedron implements Polyhedron {
  private _faces: Face[] = dualize(new TruncatedCuboctahedron().faces());

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
