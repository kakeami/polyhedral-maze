import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformPrism } from './_uniform_prism.ts';
import { gridForPolygonFace } from './_grid_dispatch.ts';

/**
 * Decagonal Prism (uniform, n=10). 12 faces: 2 decagons + 10 squares.
 * 20 vertices, 30 edges. D_10h has central inversion.
 */
export class DecagonalPrism implements Polyhedron {
  private _faces = normalizeFaces(uniformPrism(10), 1);

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
