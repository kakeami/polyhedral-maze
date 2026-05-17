import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformPrism } from './_uniform_prism.ts';
import { gridForPolygonFace } from './_grid_dispatch.ts';

/**
 * Octagonal Prism (uniform, n=8). 10 faces: 2 octagons + 8 squares.
 * 16 vertices, 24 edges. D_8h has central inversion.
 */
export class OctagonalPrism implements Polyhedron {
  private _faces = normalizeFaces(uniformPrism(8), 1);

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
