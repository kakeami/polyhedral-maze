import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { TriGrid } from '../grids/tri-grid.ts';
import { TruncatedDodecahedron } from '../archimedean/truncated-dodecahedron.ts';
import { dualize } from './_dualize.ts';

/**
 * Triakis Icosahedron: dual of the Truncated Dodecahedron.
 * 60 isoceles triangular faces, 32 vertices.
 */
export class TriakisIcosahedron implements Polyhedron {
  private _faces: Face[] = dualize(new TruncatedDodecahedron().faces());

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
