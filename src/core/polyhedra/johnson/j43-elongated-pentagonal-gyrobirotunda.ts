import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformElongatedBirotunda } from './_stack.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Elongated Pentagonal Gyrobirotunda (J43). Two pentagonal rotundas with
 * matching azimuth would yield the Icosidodecahedron after gyroelongation —
 * instead this Johnson shape has rotundas rotated by π/5 and joined to a
 * decagonal prism. 42 faces: 20 △ + 10 □ + 12 ⬠.
 */
export class ElongatedPentagonalGyrobirotunda implements Polyhedron {
  private _faces = normalizeFaces(uniformElongatedBirotunda('gyro'), 1);

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
