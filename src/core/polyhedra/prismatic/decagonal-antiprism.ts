import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformAntiprism } from './_uniform_antiprism.ts';
import { gridForPolygonFace } from './_grid_dispatch.ts';

/**
 * Decagonal Antiprism (uniform, n=10). 22 faces: 2 decagons + 20 triangles.
 * 20 vertices, 40 edges. D_10d, no central inversion (n even).
 */
export class DecagonalAntiprism implements Polyhedron {
  private _faces = normalizeFaces(uniformAntiprism(10), 1);

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
