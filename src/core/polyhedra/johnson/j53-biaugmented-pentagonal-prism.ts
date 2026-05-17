import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformPrism } from '../prismatic/_uniform_prism.ts';
import { augmentFaces } from './_augment.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Biaugmented Pentagonal Prism (J53). Pentagonal prism with square pyramids
 * (J1) attached to two non-adjacent square faces (separated by one
 * un-augmented square). 13 faces (8 triangles + 3 squares + 2 pentagons),
 * 12 vertices, 23 edges.
 */
export class BiaugmentedPentagonalPrism implements Polyhedron {
  // Lateral squares in uniformPrism(5) are face ids 2..6 around the ring.
  // Picking face 2 and face 4 leaves face 3 (one square between them).
  private _faces = normalizeFaces(
    augmentFaces(uniformPrism(5), [2, 4], 'pyramid'),
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
