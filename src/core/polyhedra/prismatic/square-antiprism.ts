import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformAntiprism } from './_uniform_antiprism.ts';
import { gridForPolygonFace } from './_grid_dispatch.ts';

/**
 * Square Antiprism (uniform, n=4). 10 faces: 2 squares + 8 triangles.
 * 8 vertices, 16 edges. D_4d, no central inversion.
 */
export class SquareAntiprism implements Polyhedron {
  private _faces = normalizeFaces(uniformAntiprism(4), 1);

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
