import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformRotunda } from './_rotunda.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Pentagonal Rotunda (J6). 17 faces: 1 decagon (bottom) + 1 pentagon (top) +
 * 5 mid pentagons + 5 upper triangles + 5 lower triangles. 20 vertices,
 * 35 edges. Equals the top half of an icosidodecahedron.
 */
export class PentagonalRotunda implements Polyhedron {
  private _faces = normalizeFaces(uniformRotunda(), 1);

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
