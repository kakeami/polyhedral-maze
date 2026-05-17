import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { TruncatedDodecahedron } from '../archimedean/truncated-dodecahedron.ts';
import { augmentFaces, findFaceAtDistance } from './_augment.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

function buildFaces() {
  const base = new TruncatedDodecahedron().faces();
  const host0 = base.find((f) => f.vertices.length === 10);
  if (!host0) throw new Error('J71: decagonal face not found');
  const host1 = findFaceAtDistance(base, host0.id, 2, [], 10);
  if (host1 < 0) throw new Error('J71: second meta decagon not found');
  const host2 = findFaceAtDistance(base, host0.id, 2, [host1], 10);
  if (host2 < 0) throw new Error('J71: third meta decagon not found');
  return augmentFaces(base, [host0.id, host1, host2], 'cupola');
}

/**
 * Triaugmented Truncated Dodecahedron (J71). Truncated dodecahedron with
 * pentagonal cupolae (J5) attached to three pairwise non-adjacent,
 * non-antipodal decagonal faces. 62 faces (35 triangles + 15 squares +
 * 3 pentagons + 9 decagons), 75 vertices, 135 edges.
 */
export class TriaugmentedTruncatedDodecahedron implements Polyhedron {
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
