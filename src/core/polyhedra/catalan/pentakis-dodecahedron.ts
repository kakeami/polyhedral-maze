import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { TriGrid } from '../grids/tri-grid.ts';
import { TruncatedIcosahedron } from '../archimedean/truncated-icosahedron.ts';
import { dualize } from './_dualize.ts';

/**
 * Pentakis Dodecahedron: dual of the Truncated Icosahedron.
 * 60 isoceles triangular faces, 32 vertices.
 */
export class PentakisDodecahedron implements Polyhedron {
  private _faces: Face[] = normalizeFaces(dualize(new TruncatedIcosahedron().faces()), 1);

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
