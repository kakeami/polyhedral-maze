import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformPyramid } from './_pyramid.ts';
import { gyroelongate } from './_gyroelongate.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Gyroelongated Pentagonal Pyramid (J11). Pentagonal pyramid (J2) stacked on
 * a pentagonal antiprism. 16 faces: 15 triangles + 1 pentagon. 11 vertices,
 * 25 edges.
 */
export class GyroelongatedPentagonalPyramid implements Polyhedron {
  private _faces = normalizeFaces(gyroelongate(uniformPyramid(5), 0), 1);

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
