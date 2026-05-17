import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { TruncatedCube } from '../archimedean/truncated-cube.ts';
import { augmentFaces, findFaceAtDistance } from './_augment.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

function buildFaces() {
  const base = new TruncatedCube().faces();
  const host0 = base.find((f) => f.vertices.length === 8);
  if (!host0) throw new Error('J67: octagonal face not found');
  // Opposite (antipodal) octagonal face: in the cube face graph, the
  // antipode is at distance 2 (every face is adjacent to 4 others and only
  // the antipode is non-adjacent).
  const host1 = findFaceAtDistance(base, host0.id, 2, [], 8);
  if (host1 < 0) throw new Error('J67: opposite octagonal face not found');
  return augmentFaces(base, [host0.id, host1], 'cupola');
}

/**
 * Biaugmented Truncated Cube (J67). Truncated cube with square cupolae (J4)
 * attached to two opposite octagonal faces. 30 faces (16 triangles +
 * 10 squares + 4 octagons), 32 vertices, 60 edges.
 */
export class BiaugmentedTruncatedCube implements Polyhedron {
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
