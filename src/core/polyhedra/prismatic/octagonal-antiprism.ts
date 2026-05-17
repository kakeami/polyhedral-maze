import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformAntiprism } from './_uniform_antiprism.ts';
import { gridForPolygonFace } from './_grid_dispatch.ts';

/**
 * Octagonal Antiprism (uniform, n=8). 18 faces: 2 octagons + 16 triangles.
 * 16 vertices, 32 edges. D_8d, no central inversion (n even).
 */
export class OctagonalAntiprism implements Polyhedron {
  private _faces = normalizeFaces(uniformAntiprism(8), 1);

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
