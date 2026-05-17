import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { TruncatedCube } from '../archimedean/truncated-cube.ts';
import { augmentWithCupola } from './_augment.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

function buildFaces() {
  const base = new TruncatedCube().faces();
  const oct = base.find((f) => f.vertices.length === 8);
  if (!oct) throw new Error('J66: octagonal face not found');
  return augmentWithCupola(base, oct.id);
}

/**
 * Augmented Truncated Cube (J66). Truncated cube with a square cupola (J4)
 * attached to one of its 6 octagonal faces. 22 faces (12 triangles +
 * 5 squares + 5 octagons), 28 vertices, 48 edges.
 */
export class AugmentedTruncatedCube implements Polyhedron {
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
