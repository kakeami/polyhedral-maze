import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { TriGrid } from '../grids/tri-grid.ts';
import { TruncatedIcosidodecahedron } from '../archimedean/truncated-icosidodecahedron.ts';
import { dualize } from './_dualize.ts';

/**
 * Disdyakis Triacontahedron: dual of the Truncated Icosidodecahedron.
 * 120 scalene triangular faces, 62 vertices.
 */
export class DisdyakisTriacontahedron implements Polyhedron {
  private _faces: Face[] = dualize(new TruncatedIcosidodecahedron().faces());

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
