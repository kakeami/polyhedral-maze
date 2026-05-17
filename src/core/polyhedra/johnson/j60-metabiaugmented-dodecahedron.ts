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
  // Meta pair: distance 2 in the face-adjacency graph (not adjacent, not
  // antipodal). Five candidates exist; the first one encountered is picked.
  const meta = findFaceAtDistance(base, 0, 2);
  if (meta < 0) throw new Error('J60: meta face not found');
  return augmentFaces(base, [0, meta], 'pyramid');
}

/**
 * Metabiaugmented Dodecahedron (J60). Dodecahedron with pentagonal pyramids
 * (J2) attached to two pentagonal faces that are neither adjacent nor
 * antipodal (meta arrangement). 20 faces (10 triangles + 10 pentagons),
 * 22 vertices, 40 edges.
 */
export class MetabiaugmentedDodecahedron implements Polyhedron {
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
