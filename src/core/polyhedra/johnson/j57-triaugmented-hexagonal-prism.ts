import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformPrism } from '../prismatic/_uniform_prism.ts';
import { augmentFaces } from './_augment.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Triaugmented Hexagonal Prism (J57). Hexagonal prism with square pyramids
 * (J1) attached to three alternating square faces (every other one).
 * 17 faces (12 triangles + 3 squares + 2 hexagons), 15 vertices, 30 edges.
 */
export class TriaugmentedHexagonalPrism implements Polyhedron {
  // Lateral squares in uniformPrism(6) are face ids 2..7. Faces 2, 4, 6 are
  // the alternating triplet.
  private _faces = normalizeFaces(
    augmentFaces(uniformPrism(6), [2, 4, 6], 'pyramid'),
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
