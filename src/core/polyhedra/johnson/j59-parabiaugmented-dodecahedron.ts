import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { Dodecahedron } from '../platonic/dodecahedron.ts';
import { augmentFaces, findFaceAtDistance } from './_augment.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

function buildFaces() {
  const base = new Dodecahedron().faces();
  // Para pair: dodecahedron face-graph diameter is 3, so the unique face at
  // distance 3 from face 0 is its antipode.
  const para = findFaceAtDistance(base, 0, 3);
  if (para < 0) throw new Error('J59: antipode face not found');
  return augmentFaces(base, [0, para], 'pyramid');
}

/**
 * Parabiaugmented Dodecahedron (J59). Dodecahedron with pentagonal pyramids
 * (J2) attached to two opposite (antipodal) pentagonal faces. 20 faces
 * (10 triangles + 10 pentagons), 22 vertices, 40 edges.
 */
export class ParabiaugmentedDodecahedron implements Polyhedron {
  private _faces = normalizeFaces(buildFaces(), 1);

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
