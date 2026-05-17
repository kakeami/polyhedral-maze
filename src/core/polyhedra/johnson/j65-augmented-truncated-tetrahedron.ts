import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { TruncatedTetrahedron } from '../archimedean/truncated-tetrahedron.ts';
import { augmentWithCupola } from './_augment.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

function buildFaces() {
  const base = new TruncatedTetrahedron().faces();
  const hex = base.find((f) => f.vertices.length === 6);
  if (!hex) throw new Error('J65: hexagonal face not found');
  return augmentWithCupola(base, hex.id);
}

/**
 * Augmented Truncated Tetrahedron (J65). Truncated tetrahedron with a
 * triangular cupola (J3) attached to one of its 4 hexagonal faces.
 * 14 faces (8 triangles + 3 squares + 3 hexagons), 15 vertices, 27 edges.
 */
export class AugmentedTruncatedTetrahedron implements Polyhedron {
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
