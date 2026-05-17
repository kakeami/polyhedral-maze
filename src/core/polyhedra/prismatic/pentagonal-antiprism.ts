import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformAntiprism } from './_uniform_antiprism.ts';
import { gridForPolygonFace } from './_grid_dispatch.ts';

/**
 * Pentagonal Antiprism (uniform, n=5). 12 faces: 2 pentagons + 10 triangles.
 * 10 vertices, 20 edges. D_5d has central inversion → every face has an
 * antipode.
 */
export class PentagonalAntiprism implements Polyhedron {
  private _faces = normalizeFaces(uniformAntiprism(5), 1);

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
