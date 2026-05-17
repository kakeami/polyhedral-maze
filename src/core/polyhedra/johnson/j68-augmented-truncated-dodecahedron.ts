import type { Face, FaceEdgeData } from '../../types.ts';
import type { FaceGrid } from '../../face-grid.ts';
import type { Polyhedron } from '../../polyhedron.ts';
import { sharedEdgeVertices, buildFaceAdjacency, normalizeFaces } from '../../polyhedron.ts';
import { Graph } from '../../graph.ts';
import { TruncatedDodecahedron } from '../archimedean/truncated-dodecahedron.ts';
import { augmentWithCupola } from './_augment.ts';
import { gridForPolygonFace } from '../prismatic/_grid_dispatch.ts';

function buildFaces() {
  const base = new TruncatedDodecahedron().faces();
  const dec = base.find((f) => f.vertices.length === 10);
  if (!dec) throw new Error('J68: decagonal face not found');
  return augmentWithCupola(base, dec.id);
}

/**
 * Augmented Truncated Dodecahedron (J68). Truncated dodecahedron with a
 * pentagonal cupola (J5) attached to one of its 12 decagonal faces.
 * 42 faces (25 triangles + 5 squares + 1 pentagon + 11 decagons),
 * 65 vertices, 105 edges.
 */
export class AugmentedTruncatedDodecahedron implements Polyhedron {
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
