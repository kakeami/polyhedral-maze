import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { Dodecahedron } from '../platonic/dodecahedron.ts';
import { augmentWithPyramid } from './_augment.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

/**
 * Augmented Dodecahedron (J58). Dodecahedron with a pentagonal pyramid (J2)
 * attached to one of its 12 pentagonal faces. 16 faces (5 triangles +
 * 11 pentagons), 21 vertices, 35 edges.
 */
export class AugmentedDodecahedron implements Polyhedron {
  private _faces = normalizeFaces(
    augmentWithPyramid(new Dodecahedron().faces(), 0),
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
