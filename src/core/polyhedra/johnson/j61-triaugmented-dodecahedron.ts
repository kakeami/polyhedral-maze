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
  // Pick three pentagonal faces such that every pair is at face-graph
  // distance 2 (mutually meta, never adjacent or antipodal).
  const second = findFaceAtDistance(base, 0, 2);
  if (second < 0) throw new Error('J61: second face not found');
  const third = findFaceAtDistance(base, 0, 2, [second]);
  if (third < 0) throw new Error('J61: third face not found');
  return augmentFaces(base, [0, second, third], 'pyramid');
}

/**
 * Triaugmented Dodecahedron (J61). Dodecahedron with pentagonal pyramids
 * (J2) attached to three pentagonal faces, every pair being meta to every
 * other (no two pyramids share an edge or sit antipodally). 24 faces
 * (15 triangles + 9 pentagons), 23 vertices, 45 edges.
 */
export class TriaugmentedDodecahedron implements Polyhedron {
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
