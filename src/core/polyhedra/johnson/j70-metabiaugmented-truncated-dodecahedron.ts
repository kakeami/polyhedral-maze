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
  if (!host0) throw new Error('J70: decagonal face not found');
  // Meta pair: decagon-graph distance 2 (neither adjacent nor antipodal).
  const host1 = findFaceAtDistance(base, host0.id, 2, [], 10);
  if (host1 < 0) throw new Error('J70: meta decagon not found');
  return augmentFaces(base, [host0.id, host1], 'cupola');
}

/**
 * Metabiaugmented Truncated Dodecahedron (J70). Truncated dodecahedron with
 * pentagonal cupolae (J5) attached to two decagonal faces that are neither
 * adjacent nor antipodal. 52 faces (30 triangles + 10 squares +
 * 2 pentagons + 10 decagons), 70 vertices, 120 edges.
 */
export class MetabiaugmentedTruncatedDodecahedron implements Polyhedron {
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
