import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformRotunda } from './_rotunda.ts';
import { gyroelongate } from './_gyroelongate.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Gyroelongated Pentagonal Rotunda (J25). J6 stacked on a decagonal antiprism.
 * 37 faces: 30 triangles + 6 pentagons + 1 decagon. 30 vertices, 65 edges.
 */
export class GyroelongatedPentagonalRotunda implements Polyhedron {
  private _faces = normalizeFaces(gyroelongate(uniformRotunda(), 1), 1);

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
