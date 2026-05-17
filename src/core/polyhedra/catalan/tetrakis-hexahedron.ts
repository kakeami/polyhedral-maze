import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { TriGrid } from '../grids/tri-grid.ts';
import { TruncatedOctahedron } from '../archimedean/truncated-octahedron.ts';
import { dualize } from './_dualize.ts';

/**
 * Tetrakis Hexahedron: dual of the Truncated Octahedron.
 * 24 isoceles triangular faces, 14 vertices.
 */
export class TetrakisHexahedron implements Polyhedron {
  private _faces: Face[] = normalizeFaces(dualize(new TruncatedOctahedron().faces()), 1);

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
