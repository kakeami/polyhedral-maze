import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformPyramid } from './_pyramid.ts';
import { gyroelongate } from './_gyroelongate.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Gyroelongated Square Pyramid (J10). Square pyramid (J1) stacked on a
 * square antiprism. 13 faces: 12 triangles + 1 square. 9 vertices, 20 edges.
 */
export class GyroelongatedSquarePyramid implements Polyhedron {
  private _faces = normalizeFaces(gyroelongate(uniformPyramid(4), 0), 1);

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
