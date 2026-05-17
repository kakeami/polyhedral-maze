import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformPrism } from './_uniform_prism.ts';
import { gridForPolygonFace } from './_grid_dispatch.ts';

/**
 * Triangular Prism (uniform, n=3). 5 faces: 2 equilateral triangles + 3
 * squares. 6 vertices, 9 edges. D_3h symmetry, no central inversion → no
 * antipodal face pairs.
 */
export class TriangularPrism implements Polyhedron {
  private _faces = normalizeFaces(uniformPrism(3), 1);

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
