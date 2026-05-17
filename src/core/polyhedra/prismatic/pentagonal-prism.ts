import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformPrism } from './_uniform_prism.ts';
import { gridForPolygonFace } from './_grid_dispatch.ts';

/**
 * Pentagonal Prism (uniform, n=5). 7 faces: 2 pentagons + 5 squares.
 * 10 vertices, 15 edges. D_5h, no central inversion.
 */
export class PentagonalPrism implements Polyhedron {
  private _faces = normalizeFaces(uniformPrism(5), 1);

  faces(): Face[] {
    return [...this._faces];
  }

  faceAdjacency(): Graph<string, Record<string, unknown>, FaceEdgeData> {
    return buildFaceAdjacency(this._faces, sharedEdgeVertices);
  }

  gridForFace(face: Face, n: number): FaceGrid {
    return gridForPolygonFace(face, n);
  }
}
