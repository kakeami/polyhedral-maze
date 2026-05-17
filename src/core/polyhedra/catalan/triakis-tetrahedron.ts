import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { TriGrid } from '../grids/tri-grid.ts';
import { TruncatedTetrahedron } from '../archimedean/truncated-tetrahedron.ts';
import { dualize } from './_dualize.ts';

/**
 * Triakis Tetrahedron: dual of the Truncated Tetrahedron.
 * 12 isoceles triangular faces, 8 vertices.
 */
export class TriakisTetrahedron implements Polyhedron {
  private _faces: Face[] = normalizeFaces(dualize(new TruncatedTetrahedron().faces()), 1);

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
