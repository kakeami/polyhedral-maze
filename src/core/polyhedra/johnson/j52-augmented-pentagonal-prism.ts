import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { uniformPrism } from '../prismatic/_uniform_prism.ts';
import { augmentWithPyramid } from './_augment.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Augmented Pentagonal Prism (J52). Pentagonal prism with a square pyramid
 * (J1) attached to one of its five square faces. 10 faces
 * (4 triangles + 4 squares + 2 pentagons), 11 vertices, 19 edges.
 */
export class AugmentedPentagonalPrism implements Polyhedron {
  private _faces = normalizeFaces(
    augmentWithPyramid(uniformPrism(5), 2),
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
