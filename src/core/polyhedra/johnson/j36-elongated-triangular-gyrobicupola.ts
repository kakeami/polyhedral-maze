import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformElongatedBicupola } from './_stack.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Elongated Triangular Gyrobicupola (J36). Cuboctahedron-derived: two
 * triangular cupolae rotated by π/3 relative to each other, separated by a
 * hexagonal prism. 20 faces: 8 △ + 12 □.
 */
export class ElongatedTriangularGyrobicupola implements Polyhedron {
  private _faces = normalizeFaces(uniformElongatedBicupola(3, 'gyro'), 1);

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
