import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformPrism } from './_uniform_prism.ts';
import { gridForPolygonFace } from './_grid_dispatch.ts';

/**
 * Hexagonal Prism (uniform, n=6). 8 faces: 2 hexagons + 6 squares.
 * 12 vertices, 18 edges. D_6h has central inversion → every face has an
 * antipode.
 */
export class HexagonalPrism implements Polyhedron {
  private _faces = normalizeFaces(uniformPrism(6), 1);

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
