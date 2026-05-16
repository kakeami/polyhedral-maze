import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { PentGrid } from '../grids/pent-grid.ts';
import { SnubCube } from '../archimedean/snub-cube.ts';
import { dualize } from './_dualize.ts';

/**
 * Pentagonal Icositetrahedron: dual of the Snub Cube.
 * 24 chiral irregular pentagonal faces, 38 vertices.
 */
export class PentagonalIcositetrahedron implements Polyhedron {
  private _faces: Face[] = dualize(new SnubCube().faces());

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
