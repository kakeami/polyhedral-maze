import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { PentGrid } from '../grids/pent-grid.ts';
import { SnubDodecahedron } from '../archimedean/snub-dodecahedron.ts';
import { dualize } from './_dualize.ts';

/**
 * Pentagonal Hexecontahedron: dual of the Snub Dodecahedron.
 * 60 chiral irregular pentagonal faces, 92 vertices.
 */
export class PentagonalHexecontahedron implements Polyhedron {
  private _faces: Face[] = dualize(new SnubDodecahedron().faces());

  faces(): Face[] {
    return [...this._faces];
  }

  faceAdjacency(): Graph<string, Record<string, unknown>, FaceEdgeData> {
    return buildFaceAdjacency(this._faces, sharedEdgeVertices);
  }

  gridForFace(face: Face, n: number): FaceGrid {
    return new PentGrid(face, n);
  }
}
