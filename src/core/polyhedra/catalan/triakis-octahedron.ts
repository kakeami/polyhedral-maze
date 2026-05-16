import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { TriGrid } from '../grids/tri-grid.ts';
import { TruncatedCube } from '../archimedean/truncated-cube.ts';
import { dualize } from './_dualize.ts';

/**
 * Triakis Octahedron: dual of the Truncated Cube.
 * 24 isoceles triangular faces, 14 vertices.
 */
export class TriakisOctahedron implements Polyhedron {
  private _faces: Face[] = dualize(new TruncatedCube().faces());

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
