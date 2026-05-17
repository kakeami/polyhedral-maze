import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformAntiprism } from './_uniform_antiprism.ts';
import { gridForPolygonFace } from './_grid_dispatch.ts';

/**
 * Hexagonal Antiprism (uniform, n=6). 14 faces: 2 hexagons + 12 triangles.
 * 12 vertices, 24 edges. D_6d has no σ_h and no inversion → no antipodes
 * apart from the top/bot hexagons.
 */
export class HexagonalAntiprism implements Polyhedron {
  private _faces = normalizeFaces(uniformAntiprism(6), 1);

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
