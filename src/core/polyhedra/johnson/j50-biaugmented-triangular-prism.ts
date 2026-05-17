import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformPrism } from '../prismatic/_uniform_prism.ts';
import { augmentFaces } from './_augment.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Biaugmented Triangular Prism (J50). Triangular prism with square pyramids
 * (J1) attached to two of its three square faces. The third square is left
 * bare; with all three augmented the shape becomes J51, a deltahedron.
 * 11 faces (10 triangles + 1 square), 8 vertices, 17 edges.
 */
export class BiaugmentedTriangularPrism implements Polyhedron {
  private _faces = normalizeFaces(
    augmentFaces(uniformPrism(3), [2, 3], 'pyramid'),
    1,
  );

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
