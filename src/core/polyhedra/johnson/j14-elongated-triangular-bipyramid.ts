import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformElongatedBipyramid } from './_elongated_bipyramid.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Elongated Triangular Bipyramid (J14). Two J12 triangular bipyramid halves
 * (= regular tetrahedron caps) separated by a triangular prism.
 * 9 faces: 6 triangles + 3 squares. 8 vertices, 15 edges.
 */
export class ElongatedTriangularBipyramid implements Polyhedron {
  private _faces = normalizeFaces(uniformElongatedBipyramid(3), 1);

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
