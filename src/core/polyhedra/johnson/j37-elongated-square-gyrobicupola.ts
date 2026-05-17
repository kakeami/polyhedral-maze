import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformElongatedBicupola } from './_stack.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Elongated Square Gyrobicupola (J37) — "pseudo-rhombicuboctahedron". J29 with
 * an octagonal prism inserted at the equator. 26 faces: 8 △ + 18 □.
 * The ortho variant of this construction is the Rhombicuboctahedron (Archimedean).
 */
export class ElongatedSquareGyrobicupola implements Polyhedron {
  private _faces = normalizeFaces(uniformElongatedBicupola(4, 'gyro'), 1);

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
